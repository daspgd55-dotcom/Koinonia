const { z } = require('zod');
const fields = ['commune', 'denominations', 'branches', 'doctrinalTags', 'activities', 'ministries', 'targetGroups', 'languages', 'meetingDays', 'radiusKm'];
const mode = z.enum(['preferred', 'required', 'disabled']);
const criterionModes = z.strictObject(Object.fromEntries(fields.map(k => [k, mode.optional()])));
const answerState = z.enum(['answered', 'no_preference', 'unknown', 'omitted']);
const answerStates = z.strictObject(Object.fromEntries([...fields, 'location', 'address', 'spiritualIdentity', 'goal', 'firstVisitPreference'].map(k => [k, answerState.optional()])));
const searchContext = z.strictObject({
  spiritualIdentity: z.enum(['christian','believer','no_religion','other_religion','nonbeliever','other']).nullable().optional(),
  address: z.string().trim().min(1).max(200).nullable().optional(),
  goal: z.enum(['join', 'explore', 'change', 'connect']).nullable().optional(),
  firstVisitPreference: z.enum(['information', 'welcome', 'contact', 'not_planned']).nullable().optional()
});
const onboarding = z.strictObject({ version: z.union([z.literal(1), z.literal(2), z.literal(3)]).optional(), status: z.enum(['pending', 'completed', 'skipped']).optional(), lastStep: z.number().int().min(0).max(7).optional() });
const present = value => value !== undefined && value !== null && (!Array.isArray(value) || value.length > 0);
module.exports = { fields, criterionModes, answerStates, searchContext, onboarding, present };
