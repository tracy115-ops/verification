import type { DesignArtifact, RequirementArtifact } from './types';

export function prefixRequirements(value: RequirementArtifact, index: number): RequirementArtifact {
  return {
    ...value,
    requirements: value.requirements.map((item) => ({ ...item, id: `R${index + 1}-${item.id}` })),
  };
}

export function mergeRequirements(values: RequirementArtifact[]): RequirementArtifact {
  const unique = new Map<string, RequirementArtifact['requirements'][number]>();
  for (const value of values)
    for (const item of value.requirements) {
      const key = JSON.stringify([item.text, item.quote, item.acceptanceCriteria]);
      if (!unique.has(key)) unique.set(key, item);
    }
  return {
    requirements: [...unique.values()],
    questions: [...new Set(values.flatMap((value) => value.questions))],
  };
}

export function prefixDesign(value: DesignArtifact, index: number): DesignArtifact {
  const prefix = `D${index + 1}-`;
  return {
    ...value,
    factors: value.factors?.map((item) => ({ ...item, id: prefix + item.id })),
    scenarios: value.scenarios.map((item) => ({
      ...item,
      id: prefix + item.id,
      factorLevels: item.factorLevels?.map((level) => ({ ...level, factorId: prefix + level.factorId })),
    })),
  };
}

export function mergeDesigns(values: DesignArtifact[]): DesignArtifact {
  const factors = new Map<string, NonNullable<DesignArtifact['factors']>[number]>();
  const aliases = new Map<string, string>();
  for (const value of values)
    for (const factor of value.factors ?? []) {
      const key = JSON.stringify([
        factor.name,
        [...factor.requirementIds].sort(),
        factor.levels,
        factor.sourceQuote,
      ]);
      if (!factors.has(key)) factors.set(key, factor);
      aliases.set(factor.id, factors.get(key)!.id);
    }
  const scenarios = new Map<string, DesignArtifact['scenarios'][number]>();
  for (const value of values)
    for (const item of value.scenarios) {
      const scenario = {
        ...item,
        factorLevels: item.factorLevels?.map((level) => ({
          ...level,
          factorId: aliases.get(level.factorId) ?? level.factorId,
        })),
      };
      const key = JSON.stringify([
        scenario.title,
        [...scenario.requirementIds].sort(),
        scenario.dimension,
        scenario.expected,
        scenario.factorLevels,
      ]);
      if (!scenarios.has(key)) scenarios.set(key, scenario);
    }
  return {
    strategy: [...new Set(values.map((item) => item.strategy))].join('\n'),
    factors: [...factors.values()],
    scenarios: [...scenarios.values()],
    gaps: [...new Set(values.flatMap((item) => item.gaps))],
  };
}
