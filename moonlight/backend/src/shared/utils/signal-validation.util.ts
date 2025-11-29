import { validate } from 'class-validator';
import Ajv from 'ajv';
import addFormats from 'ajv-formats';
import { CanonicalSignalDTO } from '../dto/canonical-signal.dto';
import * as signalSchema from '../../../../shared/schemas/signal.schema.json';

const ajv = new Ajv({ allErrors: true });
addFormats(ajv);
const validateSignalSchema = ajv.compile(signalSchema);

export interface ValidationResult {
  ok: boolean;
  errors?: string[];
}

export async function validateCanonicalSignal(
  dto: CanonicalSignalDTO,
): Promise<ValidationResult> {
  const errors: string[] = [];

  const classValidatorErrors = await validate(dto);
  if (classValidatorErrors.length > 0) {
    classValidatorErrors.forEach((error) => {
      if (error.constraints) {
        errors.push(...Object.values(error.constraints));
      }
    });
  }

  const plainObject = JSON.parse(JSON.stringify(dto));
  const schemaValid = validateSignalSchema(plainObject);
  if (!schemaValid && validateSignalSchema.errors) {
    validateSignalSchema.errors.forEach((error) => {
      errors.push(`${error.instancePath} ${error.message}`);
    });
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true };
}
