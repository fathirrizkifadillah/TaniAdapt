/**
 * Rules Loader and Accessor for TaniAdapt Decision Engine.
 * All scientific values and thresholds MUST originate from rules.json.
 */

import rulesJson from './rules.json';

export interface RuleDefinition {
  id: string;
  action: string;
  condition: Record<string, any>;
  unit: string;
  evidence_id: string | null;
  status: 'VERIFIED_METHOD' | 'METHOD_UNCALIBRATED' | 'CONVENTION_PENDING' | 'INSUFFICIENT' | 'DEPRECATED';
  status_label: string;
  crop_scope: string[];
  source_data: string;
  config?: Record<string, any>;
  description: string;
  notes: string;
}

export interface RulesPayload {
  rules_version: string;
  last_updated: string;
  description: string;
  status_hierarchy: Record<string, string>;
  rules: RuleDefinition[];
}

export const RULES_DATA: RulesPayload = rulesJson as unknown as RulesPayload;

export function getRuleById(id: string): RuleDefinition | undefined {
  return RULES_DATA.rules.find((r) => r.id === id);
}

export function getRulesByAction(action: string): RuleDefinition[] {
  return RULES_DATA.rules.filter((r) => r.action === action);
}

export function getFao56DepletionConfig(): Record<string, any> {
  const rule = getRuleById('RULE_WATER_FAO56_DEPLETION');
  if (!rule || !rule.config) {
    throw new Error('RULE_WATER_FAO56_DEPLETION config missing in rules.json');
  }
  return rule.config;
}
