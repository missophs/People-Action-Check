// PAC scenario names and question sets — CJS mirror of src/core/scenarios.js.
// Used by pac-slack.js (Netlify Function). Keep in sync with SCENARIO_QUESTIONS in scenarios.js.

const SCENARIO_NAMES = [
  "Performance Decline",
  "Attendance Issue",
  "Interpersonal Conflict",
  "Policy Violation",
  "Termination Consideration",
  "Accommodation Request",
  "Harassment / Discrimination",
  "Retaliation Concern",
  "Reduction in Force",
  "Leave of Absence",
];

const SCENARIO_QUESTIONS = {
  "Performance Decline": [
    { q: "Have performance expectations been clearly communicated in writing?", hint: "Verbal expectations alone are harder to defend. Look for emails, job descriptions, goal-setting documents, or meeting notes.", weight: 2, critical: false },
    { q: "Has this issue been documented in prior conversations or reviews?", hint: "A first documented conversation is fine — just make sure it is documented. Verbal-only history creates risk.", weight: 1, critical: false },
    { q: "Has the employee been given a clear opportunity to respond to concerns?", hint: "This means a real conversation, not just an email. The employee should be able to explain context.", weight: 1, critical: false },
    { q: "Is the performance decline consistent and ongoing (not a single incident)?", hint: "A pattern over time is stronger than one bad week. Consider whether something changed.", weight: 1, critical: false },
    { q: "Are there known leave, medical, or accommodation factors at play?", hint: "If yes, or if you're not sure, stop and consult HR before taking any action.", weight: 2, critical: true },
  ],
  "Attendance Issue": [
    { q: "Is there a written attendance policy the employee has acknowledged?", hint: "Without a clear policy, enforcement is difficult to defend. Check your employee handbook.", weight: 2, critical: false },
    { q: "Has the pattern been documented with dates and frequency?", hint: "A log of specific dates and context provided matters enormously if this progresses to discipline.", weight: 1, critical: false },
    { q: "Has the employee been formally notified that attendance is an issue?", hint: "A documented conversation is required before formal discipline.", weight: 1, critical: false },
    { q: "Have you confirmed that no protected leave applies to these absences?", hint: "FMLA, ADA, state sick leave, and other protections can cover absences you might otherwise count.", weight: 2, critical: true },
    { q: "Has the policy been enforced consistently across your team?", hint: "If you have tolerated similar patterns from others, disciplining one person exposes you to disparate treatment claims.", weight: 2, critical: false },
  ],
  "Interpersonal Conflict": [
    { q: "Have you gathered facts from all parties involved, not just the complainant?", hint: "Acting on one person's account without hearing others is a procedural mistake.", weight: 2, critical: false },
    { q: "Have you given each affected employee an opportunity to be heard?", hint: "This protects both the process and the employees.", weight: 1, critical: false },
    { q: "Is the behavior materially affecting work output, team function, or the work environment?", hint: "Personality differences are not automatically an HR matter.", weight: 1, critical: false },
    { q: "Are there prior documented incidents involving these individuals?", hint: "A pattern changes the situation significantly.", weight: 1, critical: false },
    { q: "Is the situation escalating or involving behavior tied to a protected characteristic?", hint: "If the behavior involves race, gender, age, religion, or other protected characteristics, this may be harassment.", weight: 2, critical: true },
  ],
  "Policy Violation": [
    { q: "Is the policy written, accessible, and clearly worded?", hint: "Employees must have had reasonable access to the policy before the violation occurred.", weight: 2, critical: false },
    { q: "Has this policy been applied consistently to others in similar situations?", hint: "Disciplining one person for a violation while ignoring the same behavior from others is a disparate treatment risk.", weight: 2, critical: true },
    { q: "Would the employee reasonably have understood that this behavior violated policy?", hint: "Even with a written policy, enforcement requires the employee could reasonably have known this applied.", weight: 1, critical: false },
    { q: "Is this a first offense, or is there prior disciplinary history?", hint: "Most progressive discipline frameworks require different responses for first vs. repeat violations.", weight: 1, critical: false },
    { q: "Are there mitigating circumstances that warrant consideration before acting?", hint: "Long tenure, clean history, personal circumstances, or policy ambiguity are factors attorneys will ask about.", weight: 1, critical: false },
  ],
  "Termination Consideration": [
    { q: "Is there documented progressive discipline (verbal, written, PIP if applicable)?", hint: "A clean progressive record is your primary defense against wrongful termination claims.", weight: 2, critical: false },
    { q: "Was the employee given a genuine opportunity to improve with clear expectations?", hint: "PIPs and written warnings only protect you if the employee was given a real chance to meet them.", weight: 1, critical: false },
    { q: "Are you following your organization's written termination process?", hint: "Many wrongful termination claims hinge on whether your own process was followed.", weight: 2, critical: false },
    { q: "Is there any legal or protected-leave exposure connected to this employee?", hint: "Recent FMLA leave, ADA accommodation, protected complaint, or pregnancy all create heightened scrutiny.", weight: 2, critical: true },
    { q: "Has HR or legal been consulted if required by your process or the circumstances?", hint: "For terminations with legal exposure flags, employment counsel should be involved before you act.", weight: 2, critical: true },
  ],
  "Accommodation Request": [
    { q: "Has the accommodation request been acknowledged and documented in writing?", hint: "Even a verbal request triggers obligations. The interactive process begins when the need is expressed.", weight: 1, critical: false },
    { q: "Have you initiated the interactive process with the employee?", hint: "The interactive process means a real, documented conversation about what the employee needs. It is legally required.", weight: 2, critical: true },
    { q: "Has HR or legal been informed and involved?", hint: "Accommodation decisions should not be made by a manager alone.", weight: 2, critical: true },
    { q: "Have you obtained the necessary medical documentation (if applicable)?", hint: "You can request documentation confirming the need — but only ask for what is directly relevant.", weight: 1, critical: false },
    { q: "Have you assessed whether accommodation creates undue hardship?", hint: "Undue hardship is a high legal bar. Most accommodations do not meet this threshold.", weight: 1, critical: false },
  ],
  "Harassment / Discrimination": [
    { q: "Has the complaint been documented and acknowledged to the complainant?", hint: "The employee must know their complaint was received and taken seriously.", weight: 1, critical: false },
    { q: "Is HR or legal already involved in this situation?", hint: "Non-negotiable for harassment and discrimination complaints.", weight: 2, critical: true },
    { q: "Has the complainant been informed of their protections against retaliation?", hint: "This is a required communication in most jurisdictions. It should happen at the outset, in writing.", weight: 1, critical: false },
    { q: "Is a neutral investigation underway or formally planned?", hint: "An investigation must be prompt, thorough, and conducted by someone without a conflict of interest.", weight: 2, critical: true },
    { q: "Are the parties currently separated to minimize further harm while the investigation proceeds?", hint: "This may mean schedule adjustments or remote work — but must not punish the complainant.", weight: 1, critical: false },
  ],
  "Retaliation Concern": [
    { q: "Has the employee engaged in protected activity within the past 12 months?", hint: "Protected activity includes: filing an HR complaint, requesting accommodation, taking FMLA, participating in an investigation.", weight: 2, critical: true },
    { q: "Is the adverse action you are considering closely timed to that activity?", hint: "Courts consider anything within a few weeks to a few months as potentially suspicious.", weight: 2, critical: true },
    { q: "Has HR or legal reviewed the proposed action and its timing?", hint: "No adverse action should proceed in this context without independent review.", weight: 2, critical: true },
    { q: "Is there documented, non-retaliatory business rationale that predates the protected activity?", hint: "If the issue existed before the complaint, show documentation that proves it.", weight: 1, critical: false },
    { q: "Has the employee been informed of their anti-retaliation rights?", hint: "Most federal and state laws require this communication.", weight: 1, critical: false },
  ],
  "Reduction in Force": [
    { q: "Is there a documented, legitimate business rationale for the RIF?", hint: "Budget reduction, restructuring, role elimination — the reason must be real and documentable.", weight: 2, critical: false },
    { q: "Were the selection criteria defined and applied consistently before individuals were identified?", hint: "Selection criteria must be established before you run the names.", weight: 2, critical: true },
    { q: "Has legal reviewed the selection pool for adverse impact?", hint: "Run the statistical analysis: what percentage of each protected group is affected?", weight: 2, critical: true },
    { q: "Have WARN Act obligations been assessed (for US employers)?", hint: "50+ employees laid off in 30 days at a single site may trigger 60-day advance notice requirements.", weight: 2, critical: true },
    { q: "Are severance agreements and required disclosures prepared and legally reviewed?", hint: "Agreements offering severance in exchange for a release of claims must meet specific legal requirements.", weight: 1, critical: false },
  ],
  "Leave of Absence": [
    { q: "Have you confirmed whether the employee is eligible for leave under applicable law?", hint: "FMLA requires 12 months of employment and 1,250 hours. State laws often have lower thresholds.", weight: 1, critical: false },
    { q: "Have you identified which type(s) of leave apply to this situation?", hint: "FMLA, ADA, state medical leave, parental leave, military leave — multiple laws can apply simultaneously.", weight: 2, critical: true },
    { q: "Has the required paperwork been provided to the employee within the legally required timeframe?", hint: "FMLA requires a Notice of Eligibility within 5 business days.", weight: 1, critical: false },
    { q: "Are all leave dates, communications, and medical certifications being documented?", hint: "This protects you if the employee later claims they were not approved.", weight: 1, critical: false },
    { q: "Have you confirmed the return-to-work process and whether an accommodation review is needed?", hint: "An employee returning from medical leave may need an ADA accommodation review.", weight: 1, critical: false },
  ],
};

const NEXT_STEPS = {
  "Performance Decline":        { good: ["Schedule a documented performance conversation this week with specific examples.", "Issue a written memo confirming expectations, the gap, and what success looks like. Get a signature.", "Set a structured check-in date 2–4 weeks out and put it on the calendar."], warn: ["Review your documentation for completeness before scheduling any meeting.", "Consult HR before issuing a formal PIP — confirm the process, timeline, and language.", "Assess whether any accommodation or leave factors need to be cleared before proceeding."], risk: ["Stop. Do not schedule any disciplinary meeting until HR has reviewed the full situation.", "Pull together all documentation and present it to HR for a legal risk assessment.", "Do not take any adverse action until cleared."] },
  "Attendance Issue":           { good: ["Issue a documented verbal or written reminder citing the specific policy and dates of concern.", "Provide the employee a written copy of the attendance policy and note the delivery.", "Set a 30-day monitoring window with clear expectations and a follow-up date."], warn: ["Before issuing any discipline, confirm with HR that no protected leave applies.", "Check whether others with similar patterns have been treated the same way.", "Have HR review your proposed disciplinary action before delivery."], risk: ["Pause all disciplinary action immediately. Do not issue any warnings yet.", "Determine whether FMLA, ADA, state leave, or another protected category covers the absences.", "Legal review is required before any adverse action can proceed."] },
  "Interpersonal Conflict":     { good: ["Facilitate a structured mediation conversation with clear ground rules and documented outcomes.", "Issue a written summary of the conversation and expected behavioral changes to both parties.", "Check in with both parties individually within two weeks to assess whether the resolution is holding."], warn: ["Get written statements from all parties before taking any action.", "Determine whether the behavior meets the threshold for a formal investigation.", "Consult HR on whether this should remain a coaching situation or become a formal matter."], risk: ["Treat this as a potential harassment or hostile work environment situation. Do not attempt to resolve it informally.", "Initiate a formal investigation through HR.", "Loop in HR and employment counsel before communicating anything to the parties."] },
  "Policy Violation":           { good: ["Issue appropriate discipline per your progressive discipline framework.", "Document the violation, the evidence, and the disciplinary action taken. Get a signature.", "Confirm in writing that the employee understands the policy and what a repeat offense would mean."], warn: ["Before acting, audit whether this policy has been applied consistently across the team.", "Confirm the policy was communicated and accessible before the violation occurred.", "Have HR review the proposed disciplinary action and documentation before delivery."], risk: ["Do not issue any discipline yet. Inconsistent enforcement creates disparate treatment liability.", "Conduct a consistency audit across your team and document your findings.", "HR and employment counsel must review before any action is taken."] },
  "Termination Consideration":  { good: ["Proceed with termination following your written process. Do not improvise.", "Prepare final pay, separation paperwork, and benefits information per applicable law.", "Have HR present for the conversation. Keep it brief, factual, and document the meeting."], warn: ["Do not schedule the termination meeting until documentation gaps are addressed.", "Have HR assess whether a final written warning or extended PIP is required first.", "Recheck leave and accommodation status — confirm there is no concurrent protected activity."], risk: ["Stop. Do not schedule, communicate, or hint at the termination until legal review is complete.", "Employment counsel must review the full documentation, timeline, and legal exposure before you proceed.", "Any adverse action right now carries significant legal risk. Wait for clearance."] },
  "Accommodation Request":      { good: ["Continue the interactive process. Document every conversation, decision, and outcome.", "Respond to the employee in writing with the accommodation decision and rationale.", "Set a review date to assess whether the accommodation is working."], warn: ["Initiate the interactive process immediately if it has not started. Delay is itself a violation.", "Do not deny or informally dismiss the request without a documented HR and legal review.", "Ensure every communication about the request is in writing and retained."], risk: ["Do not take any adverse action while the accommodation request is pending.", "Escalate to HR and employment counsel today. The interactive process must begin immediately.", "Failure to engage the interactive process is an independent legal violation."] },
  "Harassment / Discrimination": { good: ["Ensure the investigation is conducted by a neutral party with no stake in the outcome.", "Document all investigation steps, witness interviews, and findings in a formal written report.", "Communicate the outcome to both the complainant and respondent as required by your policy."], warn: ["Separate the parties immediately if they are in direct contact.", "If HR is not already involved, escalate now. Today.", "Confirm in writing to the complainant that retaliation is prohibited."], risk: ["This requires immediate escalation to HR and employment counsel. No exceptions.", "Do not attempt to resolve this informally or conduct the investigation yourself.", "Preserve all related documents, emails, messages, and records. Do not delete anything."] },
  "Retaliation Concern":        { good: ["Document the business rationale for the adverse action independently of any prior protected activity.", "Brief HR on the full timeline — when the protected activity occurred and when the performance issue arose.", "Confirm the employee has received written notice of their anti-retaliation rights."], warn: ["Have employment counsel review the timing and proposed rationale before taking any action.", "Document the non-retaliatory reason in detail, with evidence that predates the protected activity.", "Do not communicate the adverse action until legal review is complete."], risk: ["Stop all adverse action immediately. Do not proceed with any next steps.", "This situation requires employment counsel review before anything else happens.", "Retaliation claims are among the most expensive HR legal exposures."] },
  "Reduction in Force":         { good: ["Proceed with separation meetings per your established RIF protocol and script.", "Ensure all severance agreements comply with applicable law, including OWBPA for employees over 40.", "Provide all required notices, benefits continuation information, and outplacement resources."], warn: ["Complete the adverse impact analysis before finalizing the selection list.", "Confirm WARN Act applicability with employment counsel before announcing dates.", "Ensure every selection decision has a documented, non-discriminatory business rationale."], risk: ["Do not proceed with any separations until employment counsel has signed off.", "The adverse impact analysis and legal review are not optional.", "WARN Act violations, adverse impact claims, and OWBPA defects all carry significant financial exposure."] },
  "Leave of Absence":           { good: ["Provide all required leave paperwork within the legally required timeframe.", "Communicate clearly in writing about return-to-work expectations and the extension process.", "Document all leave-related conversations, approvals, and certifications."], warn: ["Identify the applicable leave type before taking any action.", "Do not count leave-protected absences in any attendance discipline or performance review.", "Consult HR on whether state leave laws provide protections beyond the federal minimum."], risk: ["Stop. Taking any action while leave protections are unconfirmed is high-risk.", "Escalate to HR today to identify all applicable leave laws and employer obligations.", "Legal review is required before any action — including denial of leave or attendance discipline."] },
};

module.exports = { SCENARIO_NAMES, SCENARIO_QUESTIONS, NEXT_STEPS };
