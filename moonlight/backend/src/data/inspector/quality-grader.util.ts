import { QualityGrade } from '../../shared/dto/data-quality-snapshot.dto';

export function gradeDataQuality(input: {
  coveragePct: number;
  gapPct: number;
}): QualityGrade {
  const { coveragePct, gapPct } = input;

  if (coveragePct < 90 || gapPct > 10) {
    return QualityGrade.REJECTED;
  }

  if (coveragePct >= 99 && gapPct <= 1) {
    return QualityGrade.A;
  }

  if (coveragePct >= 95 && gapPct <= 4) {
    return QualityGrade.B;
  }

  return QualityGrade.C;
}
