/**
 * Reusable cdk-nag suppression helper (TypeScript).
 *
 * Use this wrapper INSTEAD of calling `NagSuppressions` directly. It enforces the
 * one rule that makes suppressions safe: every waiver carries a non-empty,
 * human-readable reason. A suppression without a justification is a latent
 * incident — this helper refuses to create one.
 *
 * Usage:
 *   import { suppress } from './nag-suppressions';
 *   suppress(myBucket, [
 *     { id: 'AwsSolutions-S1', reason: 'Access logging not needed for ephemeral 24h artifact bucket.' },
 *   ]);
 *
 * Pair with the app-entry Aspect (error-level findings fail synth):
 *   import { Aspects } from 'aws-cdk-lib';
 *   import { AwsSolutionsChecks } from 'cdk-nag';
 *   Aspects.of(app).add(new AwsSolutionsChecks());   // verbose defaults on; error-level fails synth
 */
import { NagSuppressions } from 'cdk-nag';
import type { IConstruct } from 'constructs';

export interface Suppression {
  /** cdk-nag rule id, e.g. 'AwsSolutions-IAM5'. */
  readonly id: string;
  /** Why this violation is acceptable. MUST be a real justification. */
  readonly reason: string;
  /** Optional: limit the suppression to specific findings within the rule. */
  readonly appliesTo?: string[];
}

const MIN_REASON_LEN = 15;
// Reject reasons that are placeholders rather than justifications.
const PLACEHOLDER = /^(todo|fixme|tbd|fix later|n\/?a|-+|\.+)$/i;

function assertJustified(s: Suppression): void {
  const reason = (s.reason ?? '').trim();
  if (!reason) {
    throw new Error(`cdk-nag suppression for "${s.id}" has an empty reason. Every waiver must be justified.`);
  }
  if (reason.length < MIN_REASON_LEN || PLACEHOLDER.test(reason)) {
    throw new Error(
      `cdk-nag suppression for "${s.id}" has a placeholder reason (${JSON.stringify(reason)}). ` +
        `Write a real justification (>=${MIN_REASON_LEN} chars) or fix the finding.`,
    );
  }
  if (!s.id || !/^AwsSolutions-|^HIPAA|^NIST|^PCI/.test(s.id)) {
    throw new Error(`cdk-nag suppression has an invalid rule id: ${JSON.stringify(s.id)}.`);
  }
}

/**
 * Suppress one or more cdk-nag findings on a specific construct, with an
 * enforced justification per entry. Prefer this over stack-wide suppressions —
 * scope each waiver as tightly as possible.
 */
export function suppress(construct: IConstruct, entries: Suppression[], applyToChildren = false): void {
  if (!entries?.length) throw new Error('suppress() called with no entries.');
  entries.forEach(assertJustified);
  NagSuppressions.addResourceSuppressions(construct, entries as any, applyToChildren);
}

/**
 * Path-based suppression for constructs created inside L3 constructs / helpers
 * where you don't hold the object reference (e.g. BucketDeployment's handler).
 * Same justification enforcement.
 */
export function suppressByPath(stack: IConstruct, path: string, entries: Suppression[]): void {
  if (!entries?.length) throw new Error('suppressByPath() called with no entries.');
  entries.forEach(assertJustified);
  // NagSuppressions.addResourceSuppressionsByPath is a static on the stack's construct tree.
  (NagSuppressions as any).addResourceSuppressionsByPath(stack, path, entries);
}

// NOTE: There is intentionally NO "suppress everything" / wildcard helper.
// Silencing without justification is the failure mode this file exists to prevent.
