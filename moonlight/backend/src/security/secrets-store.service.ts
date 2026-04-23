// MoonLight V2.6-2 — Secrets Vault
//
// Two-backend secrets store for the packaged .exe:
//
//   1. `keytar` (primary, platform-native OS keychain)
//        - Windows  → Credential Vault (DPAPI)
//        - macOS    → Keychain
//        - Linux    → libsecret / GNOME Keyring
//      Lazy-loaded (optional dep) to keep the backend boot clean on
//      machines that don't have it yet.
//
//   2. Encrypted-file fallback (`<userData>/moonlight-vault.enc`)
//        - AES-256-GCM with a machine-bound key (scrypt over a stable
//          machine identifier) so the file is useless if exfiltrated to
//          another machine.
//        - Used when keytar fails to load (e.g. Linux w/o libsecret) or
//          MOONLIGHT_VAULT_FORCE_FILE=true is set for testing.
//
// Never returns secret *values* to callers that didn't explicitly ask
// via `get(key)`. The REST surface only exposes `list()` (keys + masked
// previews) and `has(key)`. Callers that actually need the value go
// through the server-side BrokerCredentialsService which pulls from
// this vault internally.

import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import * as fs from 'fs';
import * as os from 'os';
import * as path from 'path';

export interface SecretMetadata {
  key: string;
  preview: string;      // last 4 chars, never the full value
  length: number;
  backend: 'keytar' | 'file';
  updatedAtUtc: string;
}

export interface SecretsAuditEvent {
  timestamp: string;
  action: 'set' | 'get' | 'delete' | 'list' | 'has';
  key: string;
  actor: string;
  backend: 'keytar' | 'file' | 'none';
  ok: boolean;
  reason?: string;
}

interface KeytarLike {
  setPassword(service: string, account: string, password: string): Promise<void>;
  getPassword(service: string, account: string): Promise<string | null>;
  deletePassword(service: string, account: string): Promise<boolean>;
  findCredentials?(service: string): Promise<Array<{ account: string; password: string }>>;
}

/**
 * Lazy-load keytar; returns null if unavailable.
 */
function loadKeytar(): KeytarLike | null {
  if (process.env.MOONLIGHT_VAULT_FORCE_FILE === 'true') return null;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const mod = require('keytar');
    if (mod?.setPassword && mod?.getPassword && mod?.deletePassword) {
      return mod as KeytarLike;
    }
    return null;
  } catch {
    return null;
  }
}

const SERVICE = 'moonlight-owner-console';

/**
 * Stable per-machine identifier used to derive the file-vault key.
 * Hostname + cpu model + user info is a workable compromise for the
 * desktop case (we want the file to be tied to this machine, but we also
 * don't want to require admin for a CSRNG-backed seed file).
 */
function machineKeyMaterial(): string {
  return [
    os.hostname() || 'no-host',
    os.platform(),
    os.arch(),
    os.userInfo().username || 'no-user',
    os.cpus()?.[0]?.model || 'no-cpu',
  ].join('|');
}

@Injectable()
export class SecretsStoreService {
  private readonly logger = new Logger(SecretsStoreService.name);
  private keytar: KeytarLike | null;
  private readonly fileBackend: FileSecretsBackend;
  private readonly audit: SecretsAuditEvent[] = [];
  private readonly maxAuditEntries = 1000;

  constructor() {
    this.keytar = loadKeytar();
    if (!this.keytar) {
      this.logger.warn(
        'keytar not available — falling back to AES-256-GCM file vault. ' +
          'Install `yarn add -W keytar` on the target platform for OS-keychain backing.',
      );
    } else {
      this.logger.log('keytar loaded — using OS keychain / DPAPI');
    }
    this.fileBackend = new FileSecretsBackend(this.fileVaultPath());
  }

  backendName(): 'keytar' | 'file' {
    return this.keytar ? 'keytar' : 'file';
  }

  isHardened(): boolean {
    // "Hardened" means we have a real OS-keychain backing.
    return this.keytar !== null;
  }

  private fileVaultPath(): string {
    // MOONLIGHT_VAULT_PATH override for tests + CI.
    if (process.env.MOONLIGHT_VAULT_PATH) return process.env.MOONLIGHT_VAULT_PATH;
    const home =
      process.env.MOONLIGHT_HOME ||
      path.join(os.homedir(), '.moonlight');
    try {
      fs.mkdirSync(home, { recursive: true });
    } catch {
      /* best-effort */
    }
    return path.join(home, 'moonlight-vault.enc');
  }

  // ---------------------------------------------------------------------
  // Public API
  // ---------------------------------------------------------------------

  async set(key: string, value: string, actor = 'system'): Promise<SecretMetadata> {
    try {
      this.assertKey(key);
      if (typeof value !== 'string' || value.length === 0) {
        throw new Error('secret value must be a non-empty string');
      }
      if (this.keytar) {
        await this.keytar.setPassword(SERVICE, key, value);
      } else {
        await this.fileBackend.set(key, value);
      }
      this.trail({
        timestamp: new Date().toISOString(),
        action: 'set',
        key,
        actor,
        backend: this.backendName(),
        ok: true,
      });
      return this.metadataFor(key, value);
    } catch (err) {
      this.trail({
        timestamp: new Date().toISOString(),
        action: 'set',
        key,
        actor,
        backend: this.backendName(),
        ok: false,
        reason: (err as Error).message,
      });
      throw err;
    }
  }

  async get(key: string, actor = 'system'): Promise<string | null> {
    this.assertKey(key);
    try {
      const val = this.keytar
        ? await this.keytar.getPassword(SERVICE, key)
        : await this.fileBackend.get(key);
      this.trail({
        timestamp: new Date().toISOString(),
        action: 'get',
        key,
        actor,
        backend: this.backendName(),
        ok: true,
      });
      return val;
    } catch (err) {
      this.trail({
        timestamp: new Date().toISOString(),
        action: 'get',
        key,
        actor,
        backend: this.backendName(),
        ok: false,
        reason: (err as Error).message,
      });
      throw err;
    }
  }

  async has(key: string, actor = 'system'): Promise<boolean> {
    const v = await this.get(key, actor);
    return v !== null && v !== undefined && v.length > 0;
  }

  async delete(key: string, actor = 'system'): Promise<boolean> {
    this.assertKey(key);
    try {
      const deleted = this.keytar
        ? await this.keytar.deletePassword(SERVICE, key)
        : await this.fileBackend.delete(key);
      this.trail({
        timestamp: new Date().toISOString(),
        action: 'delete',
        key,
        actor,
        backend: this.backendName(),
        ok: true,
      });
      return deleted;
    } catch (err) {
      this.trail({
        timestamp: new Date().toISOString(),
        action: 'delete',
        key,
        actor,
        backend: this.backendName(),
        ok: false,
        reason: (err as Error).message,
      });
      throw err;
    }
  }

  /**
   * List all stored secrets as metadata (NEVER value).
   * For keytar we try findCredentials(service) when supported; otherwise
   * we fall back to a tracked key list kept in the file backend sidecar.
   */
  async list(actor = 'system'): Promise<SecretMetadata[]> {
    try {
      if (this.keytar?.findCredentials) {
        const creds = await this.keytar.findCredentials(SERVICE);
        this.trail({
          timestamp: new Date().toISOString(),
          action: 'list',
          key: '*',
          actor,
          backend: 'keytar',
          ok: true,
        });
        return creds.map((c) => this.metadataFor(c.account, c.password));
      }
      // Index-less keytar impls — fall through to the sidecar.
      const keys = await this.fileBackend.listKeys();
      const out: SecretMetadata[] = [];
      for (const key of keys) {
        const val = this.keytar
          ? (await this.keytar.getPassword(SERVICE, key)) ?? ''
          : (await this.fileBackend.get(key)) ?? '';
        if (val) out.push(this.metadataFor(key, val));
      }
      this.trail({
        timestamp: new Date().toISOString(),
        action: 'list',
        key: '*',
        actor,
        backend: this.backendName(),
        ok: true,
      });
      return out;
    } catch (err) {
      this.trail({
        timestamp: new Date().toISOString(),
        action: 'list',
        key: '*',
        actor,
        backend: this.backendName(),
        ok: false,
        reason: (err as Error).message,
      });
      throw err;
    }
  }

  getAuditTrail(limit = 100): SecretsAuditEvent[] {
    return this.audit.slice(-Math.max(1, Math.min(limit, this.maxAuditEntries)));
  }

  /** TEST-ONLY: wipe file backend + audit. Never touches OS keychain. */
  async __resetForTests(): Promise<void> {
    await this.fileBackend.__reset();
    this.audit.length = 0;
  }

  // ---------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------

  private metadataFor(key: string, value: string): SecretMetadata {
    return {
      key,
      preview: value.length <= 4 ? '****' : `****${value.slice(-4)}`,
      length: value.length,
      backend: this.backendName(),
      updatedAtUtc: new Date().toISOString(),
    };
  }

  private assertKey(key: string): void {
    if (typeof key !== 'string' || !/^[A-Z0-9_\-]{2,64}$/.test(key)) {
      throw new Error(
        'secret key must match /^[A-Z0-9_\\-]{2,64}$/ (uppercase identifier)',
      );
    }
  }

  private trail(e: SecretsAuditEvent): void {
    this.audit.push(e);
    if (this.audit.length > this.maxAuditEntries) {
      this.audit.splice(0, this.audit.length - this.maxAuditEntries);
    }
  }
}

// =======================================================================
// Encrypted-file backend
// =======================================================================

/**
 * AES-256-GCM single-file vault, keyed by a machine-bound scrypt output.
 *
 * File layout (binary):
 *   [ 12 bytes IV | 16 bytes AUTH TAG | rest = ciphertext ]
 *
 * Plaintext is a UTF-8 JSON object: { [key: string]: string }
 */
class FileSecretsBackend {
  private readonly logger = new Logger(FileSecretsBackend.name);
  private cache: Record<string, string> | null = null;

  constructor(private readonly file: string) {}

  private deriveKey(): Buffer {
    const material = machineKeyMaterial();
    const salt = Buffer.from('moonlight-v2.6-2-vault-salt', 'utf-8');
    // scrypt gives us a 32-byte AES-256 key deterministically from the
    // machine material + static salt. This is intentionally deterministic
    // so the file survives backend restarts.
    return crypto.scryptSync(material, salt, 32);
  }

  private async load(): Promise<Record<string, string>> {
    if (this.cache) return this.cache;
    if (!fs.existsSync(this.file)) {
      this.cache = {};
      return this.cache;
    }
    try {
      const buf = fs.readFileSync(this.file);
      if (buf.length < 28) throw new Error('vault file too small');
      const iv = buf.subarray(0, 12);
      const tag = buf.subarray(12, 28);
      const ct = buf.subarray(28);
      const key = this.deriveKey();
      const decipher = crypto.createDecipheriv('aes-256-gcm', key, iv);
      decipher.setAuthTag(tag);
      const pt = Buffer.concat([decipher.update(ct), decipher.final()]);
      this.cache = JSON.parse(pt.toString('utf-8')) as Record<string, string>;
      return this.cache;
    } catch (err) {
      this.logger.error(
        `failed to decrypt vault at ${this.file}: ${(err as Error).message}`,
      );
      // Fail-closed: do NOT silently discard a corrupted vault. Surface
      // the error so the operator can intervene.
      throw new Error('vault decrypt failed (possibly moved between machines)');
    }
  }

  private async save(obj: Record<string, string>): Promise<void> {
    const iv = crypto.randomBytes(12);
    const key = this.deriveKey();
    const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
    const pt = Buffer.from(JSON.stringify(obj), 'utf-8');
    const ct = Buffer.concat([cipher.update(pt), cipher.final()]);
    const tag = cipher.getAuthTag();
    const out = Buffer.concat([iv, tag, ct]);
    // atomic write
    const tmp = `${this.file}.tmp`;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    fs.writeFileSync(tmp, out, { mode: 0o600 });
    fs.renameSync(tmp, this.file);
    this.cache = obj;
  }

  async set(key: string, value: string): Promise<void> {
    const obj = { ...(await this.load()) };
    obj[key] = value;
    await this.save(obj);
  }

  async get(key: string): Promise<string | null> {
    const obj = await this.load();
    const v = obj[key];
    return typeof v === 'string' ? v : null;
  }

  async delete(key: string): Promise<boolean> {
    const obj = { ...(await this.load()) };
    if (!(key in obj)) return false;
    delete obj[key];
    await this.save(obj);
    return true;
  }

  async listKeys(): Promise<string[]> {
    const obj = await this.load();
    return Object.keys(obj);
  }

  async __reset(): Promise<void> {
    this.cache = null;
    try {
      if (fs.existsSync(this.file)) fs.unlinkSync(this.file);
    } catch {
      /* ignore */
    }
  }
}
