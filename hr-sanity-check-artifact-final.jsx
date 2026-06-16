import { useState } from "react";

const META = {
  "Performance Decline": { icon: "📉", riskLevel: "medium", riskLabel: "Moderate Risk", description: "A team member is not meeting expected standards of work output, quality, or behavior. Very manageable when handled with clear documentation and consistent communication.", examples: ["An employee who consistently missed quarterly targets despite coaching conversations over three months.", "A team member whose work quality dropped since returning from a leave of absence.", "Someone who used to be a strong performer but has been disengaged and error-prone for six weeks."], watch: "Performance issues that began after an accommodation request, leave, or protected disclosure create legal exposure and must be handled carefully." },
  "Attendance Issue": { icon: "⏰", riskLevel: "medium", riskLabel: "Moderate Risk", description: "An employee is frequently absent, late, or leaving early in a pattern affecting their work and team. Straightforward when policy is clear — complex when protected leave is involved.", examples: ["An employee who has called out 8 times in 10 weeks with no medical documentation.", "Someone consistently 30–45 minutes late despite two prior verbal conversations.", "Absences that cluster around Mondays and Fridays in a recurring pattern."], watch: "Absences that may qualify as FMLA, ADA accommodations, or state-protected leave. Disciplining an employee for protected absences is one of the most common HR legal mistakes." },
  "Interpersonal Conflict": { icon: "🤝", riskLevel: "medium", riskLabel: "Moderate Risk", description: "Two or more employees are in conflict through disagreements or friction affecting the team dynamic. Most conflicts are manageable. Some escalate into harassment or hostile workplace territory.", examples: ["Two team members who had a heated argument in a meeting and are no longer speaking.", "An employee complaining that a peer is undermining them in front of clients.", "A group dynamic where one person is being excluded from team communication."], watch: "Patterns of behavior targeting someone based on a protected characteristic. What looks like a personality conflict may legally be harassment." },
  "Policy Violation": { icon: "⚠️", riskLevel: "medium", riskLabel: "Moderate Risk", description: "An employee has violated a written or established workplace policy. The response depends on severity, whether it was a first offense, and whether the policy has been applied consistently.", examples: ["An employee who used company equipment for personal business in violation of the IT policy.", "Someone who shared confidential client information externally without authorization.", "A team member who bypassed a safety protocol resulting in a near-miss incident."], watch: "Selective enforcement. If you discipline one employee for a violation but have tolerated the same behavior from others, you create disparate treatment risk." },
  "Termination Consideration": { icon: "🚪", riskLevel: "high", riskLabel: "High Risk", description: "You are considering ending an employee's employment. This is the highest-stakes management decision you will make and carries significant legal exposure if not handled correctly.", examples: ["An employee who failed to meet goals outlined in a formal Performance Improvement Plan.", "Someone who violated a zero-tolerance policy (harassment, theft, falsifying records).", "A long-tenured employee whose role is being eliminated as part of a restructuring."], watch: "Any termination where the employee recently filed a complaint, requested accommodation, took protected leave, or belongs to a protected class." },
  "Accommodation Request": { icon: "♿", riskLevel: "high", riskLabel: "High Risk", description: "An employee has requested a change to their work conditions due to a disability, medical condition, or religious belief. The law requires an interactive process — ignoring or dismissing the request is not an option.", examples: ["An employee with a back condition requesting a standing desk or modified workstation.", "A team member with anxiety disorder requesting reduced travel or remote work.", "An employee requesting schedule modifications for religious observance."], watch: "Treating an accommodation request informally or verbally without documentation. Delay and inaction are both forms of denial under the law." },
  "Harassment / Discrimination": { icon: "🛑", riskLevel: "high", riskLabel: "High Risk", description: "An employee has reported being harassed or discriminated against based on a protected characteristic. This triggers immediate obligations and the complainant must be protected from retaliation immediately.", examples: ["An employee reports their manager made repeated comments about their age and ability to 'keep up.'", "A team member alleges they were passed over for promotion due to their race.", "An employee reports unwanted physical contact or sexually suggestive comments from a colleague."], watch: "Any action that could be interpreted as punishing the person who raised the complaint. Retaliation claims are often more costly than the underlying complaint." },
  "Retaliation Concern": { icon: "🔁", riskLevel: "high", riskLabel: "High Risk", description: "You are considering an adverse action against an employee who recently engaged in protected activity — filing a complaint, requesting accommodation, taking leave, or participating in an investigation.", examples: ["A manager wants to put an employee on a PIP two weeks after that employee filed an HR complaint.", "An employee who testified in an investigation is suddenly moved to a less desirable shift.", "A high performer who requested FMLA leave receives their first negative review one month later."], watch: "The 'temporal proximity' problem. Courts treat close timing between protected activity and adverse action as evidence of retaliation." },
  "Reduction in Force": { icon: "📋", riskLevel: "high", riskLabel: "High Risk", description: "You are eliminating positions due to business need. An RIF requires documented selection criteria, adverse impact analysis, and compliance with notice obligations.", examples: ["A company eliminating a product line and laying off the associated team.", "A department restructuring that consolidates three roles into two.", "A budget-driven reduction affecting 10% of headcount across multiple teams."], watch: "A selection pool where employees selected for separation are disproportionately from a protected group. This requires legal review before the RIF is announced." },
  "Leave of Absence": { icon: "🗓️", riskLevel: "medium", riskLabel: "Moderate Risk", description: "An employee needs extended time off for medical, family, personal, or other reasons. Different leave types carry different legal protections. Getting the leave type wrong is a common and costly error.", examples: ["An employee requesting 6 weeks off following a surgery with a slow recovery.", "A team member needing intermittent leave to care for a parent with a chronic illness.", "An employee who has exhausted PTO and is asking for unpaid leave due to a mental health condition."], watch: "Assuming a leave request is just a 'time off' issue. Many leaves trigger FMLA, ADA, state leave law, or all three simultaneously." }
};

const QS = {
  "Performance Decline": [{ q: "Have performance expectations been clearly communicated in writing?", hint: "Verbal expectations alone are harder to defend. Look for emails, job descriptions, goal-setting documents, or meeting notes.", weight: 2, critical: false }, { q: "Has this issue been documented in prior conversations or reviews?", hint: "A first documented conversation is fine — just make sure it is documented. Verbal-only history creates risk.", weight: 1, critical: false }, { q: "Has the employee been given a clear opportunity to respond to concerns?", hint: "This means a real conversation, not just an email. The employee should be able to explain context.", weight: 1, critical: false }, { q: "Is the performance decline consistent and ongoing (not a single incident)?", hint: "A pattern over time is stronger than one bad week. Consider whether something changed.", weight: 1, critical: false }, { q: "Are there known leave, medical, or accommodation factors at play?", hint: "If yes, or if you're not sure, stop and consult HR before taking any action.", weight: 2, critical: true }],
  "Attendance Issue": [{ q: "Is there a written attendance policy the employee has acknowledged?", hint: "Without a clear policy, enforcement is difficult to defend. Check your employee handbook.", weight: 2, critical: false }, { q: "Has the pattern been documented with dates and frequency?", hint: "A log of specific dates and context provided matters enormously if this progresses to discipline.", weight: 1, critical: false }, { q: "Has the employee been formally notified that attendance is an issue?", hint: "A documented conversation is required before formal discipline.", weight: 1, critical: false }, { q: "Have you confirmed that no protected leave applies to these absences?", hint: "FMLA, ADA, state sick leave, and other protections can cover absences you might otherwise count.", weight: 2, critical: true }, { q: "Has the policy been enforced consistently across your team?", hint: "If you have tolerated similar patterns from others, disciplining one person exposes you to disparate treatment claims.", weight: 2, critical: false }],
  "Interpersonal Conflict": [{ q: "Have you gathered facts from all parties involved, not just the complainant?", hint: "Acting on one person's account without hearing others is a procedural mistake.", weight: 2, critical: false }, { q: "Have you given each affected employee an opportunity to be heard?", hint: "This protects both the process and the employees.", weight: 1, critical: false }, { q: "Is the behavior materially affecting work output, team function, or the work environment?", hint: "Personality differences are not automatically an HR matter.", weight: 1, critical: false }, { q: "Are there prior documented incidents involving these individuals?", hint: "A pattern changes the situation significantly.", weight: 1, critical: false }, { q: "Is the situation escalating or involving behavior tied to a protected characteristic?", hint: "If the behavior involves race, gender, age, religion, or other protected characteristics, this may be harassment.", weight: 2, critical: true }],
  "Policy Violation": [{ q: "Is the policy written, accessible, and clearly worded?", hint: "Employees must have had reasonable access to the policy before the violation occurred.", weight: 2, critical: false }, { q: "Has this policy been applied consistently to others in similar situations?", hint: "Disciplining one person for a violation while ignoring the same behavior from others is a disparate treatment risk.", weight: 2, critical: true }, { q: "Would the employee reasonably have understood that this behavior violated policy?", hint: "Even with a written policy, enforcement requires the employee could reasonably have known this applied.", weight: 1, critical: false }, { q: "Is this a first offense, or is there prior disciplinary history?", hint: "Most progressive discipline frameworks require different responses for first vs. repeat violations.", weight: 1, critical: false }, { q: "Are there mitigating circumstances that warrant consideration before acting?", hint: "Long tenure, clean history, personal circumstances, or policy ambiguity are factors attorneys will ask about.", weight: 1, critical: false }],
  "Termination Consideration": [{ q: "Is there documented progressive discipline (verbal, written, PIP if applicable)?", hint: "A clean progressive record is your primary defense against wrongful termination claims.", weight: 2, critical: false }, { q: "Was the employee given a genuine opportunity to improve with clear expectations?", hint: "PIPs and written warnings only protect you if the employee was given a real chance to meet them.", weight: 1, critical: false }, { q: "Are you following your organization's written termination process?", hint: "Many wrongful termination claims hinge on whether your own process was followed.", weight: 2, critical: false }, { q: "Is there any legal or protected-leave exposure connected to this employee?", hint: "Recent FMLA leave, ADA accommodation, protected complaint, or pregnancy all create heightened scrutiny.", weight: 2, critical: true }, { q: "Has HR or legal been consulted if required by your process or the circumstances?", hint: "For terminations with legal exposure flags, employment counsel should be involved before you act.", weight: 2, critical: true }],
  "Accommodation Request": [{ q: "Has the accommodation request been acknowledged and documented in writing?", hint: "Even a verbal request triggers obligations. The interactive process begins when the need is expressed.", weight: 1, critical: false }, { q: "Have you initiated the interactive process with the employee?", hint: "The interactive process means a real, documented conversation about what the employee needs. It is legally required.", weight: 2, critical: true }, { q: "Has HR or legal been informed and involved?", hint: "Accommodation decisions should not be made by a manager alone.", weight: 2, critical: true }, { q: "Have you obtained the necessary medical documentation (if applicable)?", hint: "You can request documentation confirming the need — but only ask for what is directly relevant.", weight: 1, critical: false }, { q: "Have you assessed whether accommodation creates undue hardship?", hint: "Undue hardship is a high legal bar. Most accommodations do not meet this threshold.", weight: 1, critical: false }],
  "Harassment / Discrimination": [{ q: "Has the complaint been documented and acknowledged to the complainant?", hint: "The employee must know their complaint was received and taken seriously.", weight: 1, critical: false }, { q: "Is HR or legal already involved in this situation?", hint: "Non-negotiable for harassment and discrimination complaints.", weight: 2, critical: true }, { q: "Has the complainant been informed of their protections against retaliation?", hint: "This is a required communication in most jurisdictions. It should happen at the outset, in writing.", weight: 1, critical: false }, { q: "Is a neutral investigation underway or formally planned?", hint: "An investigation must be prompt, thorough, and conducted by someone without a conflict of interest.", weight: 2, critical: true }, { q: "Are the parties currently separated to minimize further harm while the investigation proceeds?", hint: "This may mean schedule adjustments or remote work — but must not punish the complainant.", weight: 1, critical: false }],
  "Retaliation Concern": [{ q: "Has the employee engaged in protected activity within the past 12 months?", hint: "Protected activity includes: filing an HR complaint, requesting accommodation, taking FMLA, participating in an investigation.", weight: 2, critical: true }, { q: "Is the adverse action you are considering closely timed to that activity?", hint: "Courts consider anything within a few weeks to a few months as potentially suspicious.", weight: 2, critical: true }, { q: "Has HR or legal reviewed the proposed action and its timing?", hint: "No adverse action should proceed in this context without independent review.", weight: 2, critical: true }, { q: "Is there documented, non-retaliatory business rationale that predates the protected activity?", hint: "If the issue existed before the complaint, show documentation that proves it.", weight: 1, critical: false }, { q: "Has the employee been informed of their anti-retaliation rights?", hint: "Most federal and state laws require this communication.", weight: 1, critical: false }],
  "Reduction in Force": [{ q: "Is there a documented, legitimate business rationale for the RIF?", hint: "Budget reduction, restructuring, role elimination — the reason must be real and documentable.", weight: 2, critical: false }, { q: "Were the selection criteria defined and applied consistently before individuals were identified?", hint: "Selection criteria must be established before you run the names.", weight: 2, critical: true }, { q: "Has legal reviewed the selection pool for adverse impact?", hint: "Run the statistical analysis: what percentage of each protected group is affected?", weight: 2, critical: true }, { q: "Have WARN Act obligations been assessed (for US employers)?", hint: "50+ employees laid off in 30 days at a single site may trigger 60-day advance notice requirements.", weight: 2, critical: true }, { q: "Are severance agreements and required disclosures prepared and legally reviewed?", hint: "Agreements offering severance in exchange for a release of claims must meet specific legal requirements.", weight: 1, critical: false }],
  "Leave of Absence": [{ q: "Have you confirmed whether the employee is eligible for leave under applicable law?", hint: "FMLA requires 12 months of employment and 1,250 hours. State laws often have lower thresholds.", weight: 1, critical: false }, { q: "Have you identified which type(s) of leave apply to this situation?", hint: "FMLA, ADA, state medical leave, parental leave, military leave — multiple laws can apply simultaneously.", weight: 2, critical: true }, { q: "Has the required paperwork been provided to the employee within the legally required timeframe?", hint: "FMLA requires a Notice of Eligibility within 5 business days.", weight: 1, critical: false }, { q: "Are all leave dates, communications, and medical certifications being documented?", hint: "This protects you if the employee later claims they were not approved.", weight: 1, critical: false }, { q: "Have you confirmed the return-to-work process and whether an accommodation review is needed?", hint: "An employee returning from medical leave may need an ADA accommodation review.", weight: 1, critical: false }]
};

const STEPS = {
  "Performance Decline": { good: ["Schedule a documented performance conversation this week with specific examples.", "Issue a written memo confirming expectations, the gap, and what success looks like. Get a signature.", "Set a structured check-in date 2–4 weeks out and put it on the calendar."], warn: ["Review your documentation for completeness before scheduling any meeting.", "Consult HR before issuing a formal PIP — confirm the process, timeline, and language.", "Assess whether any accommodation or leave factors need to be cleared before proceeding."], risk: ["Stop. Do not schedule any disciplinary meeting until HR has reviewed the full situation.", "Pull together all documentation and present it to HR for a legal risk assessment.", "Do not take any adverse action until cleared."] },
  "Attendance Issue": { good: ["Issue a documented verbal or written reminder citing the specific policy and dates of concern.", "Provide the employee a written copy of the attendance policy and note the delivery.", "Set a 30-day monitoring window with clear expectations and a follow-up date."], warn: ["Before issuing any discipline, confirm with HR that no protected leave applies.", "Check whether others with similar patterns have been treated the same way.", "Have HR review your proposed disciplinary action before delivery."], risk: ["Pause all disciplinary action immediately. Do not issue any warnings yet.", "Determine whether FMLA, ADA, state leave, or another protected category covers the absences.", "Legal review is required before any adverse action can proceed."] },
  "Interpersonal Conflict": { good: ["Facilitate a structured mediation conversation with clear ground rules and documented outcomes.", "Issue a written summary of the conversation and expected behavioral changes to both parties.", "Check in with both parties individually within two weeks to assess whether the resolution is holding."], warn: ["Get written statements from all parties before taking any action.", "Determine whether the behavior meets the threshold for a formal investigation.", "Consult HR on whether this should remain a coaching situation or become a formal matter."], risk: ["Treat this as a potential harassment or hostile work environment situation. Do not attempt to resolve it informally.", "Initiate a formal investigation through HR.", "Loop in HR and employment counsel before communicating anything to the parties."] },
  "Policy Violation": { good: ["Issue appropriate discipline per your progressive discipline framework.", "Document the violation, the evidence, and the disciplinary action taken. Get a signature.", "Confirm in writing that the employee understands the policy and what a repeat offense would mean."], warn: ["Before acting, audit whether this policy has been applied consistently across the team.", "Confirm the policy was communicated and accessible before the violation occurred.", "Have HR review the proposed disciplinary action and documentation before delivery."], risk: ["Do not issue any discipline yet. Inconsistent enforcement creates disparate treatment liability.", "Conduct a consistency audit across your team and document your findings.", "HR and employment counsel must review before any action is taken."] },
  "Termination Consideration": { good: ["Proceed with termination following your written process. Do not improvise.", "Prepare final pay, separation paperwork, and benefits information per applicable law.", "Have HR present for the conversation. Keep it brief, factual, and document the meeting."], warn: ["Do not schedule the termination meeting until documentation gaps are addressed.", "Have HR assess whether a final written warning or extended PIP is required first.", "Recheck leave and accommodation status — confirm there is no concurrent protected activity."], risk: ["Stop. Do not schedule, communicate, or hint at the termination until legal review is complete.", "Employment counsel must review the full documentation, timeline, and legal exposure before you proceed.", "Any adverse action right now carries significant legal risk. Wait for clearance."] },
  "Accommodation Request": { good: ["Continue the interactive process. Document every conversation, decision, and outcome.", "Respond to the employee in writing with the accommodation decision and rationale.", "Set a review date to assess whether the accommodation is working."], warn: ["Initiate the interactive process immediately if it has not started. Delay is itself a violation.", "Do not deny or informally dismiss the request without a documented HR and legal review.", "Ensure every communication about the request is in writing and retained."], risk: ["Do not take any adverse action while the accommodation request is pending.", "Escalate to HR and employment counsel today. The interactive process must begin immediately.", "Failure to engage the interactive process is an independent legal violation."] },
  "Harassment / Discrimination": { good: ["Ensure the investigation is conducted by a neutral party with no stake in the outcome.", "Document all investigation steps, witness interviews, and findings in a formal written report.", "Communicate the outcome to both the complainant and respondent as required by your policy."], warn: ["Separate the parties immediately if they are in direct contact.", "If HR is not already involved, escalate now. Today.", "Confirm in writing to the complainant that retaliation is prohibited."], risk: ["This requires immediate escalation to HR and employment counsel. No exceptions.", "Do not attempt to resolve this informally or conduct the investigation yourself.", "Preserve all related documents, emails, messages, and records. Do not delete anything."] },
  "Retaliation Concern": { good: ["Document the business rationale for the adverse action independently of any prior protected activity.", "Brief HR on the full timeline — when the protected activity occurred and when the performance issue arose.", "Confirm the employee has received written notice of their anti-retaliation rights."], warn: ["Have employment counsel review the timing and proposed rationale before taking any action.", "Document the non-retaliatory reason in detail, with evidence that predates the protected activity.", "Do not communicate the adverse action until legal review is complete."], risk: ["Stop all adverse action immediately. Do not proceed with any next steps.", "This situation requires employment counsel review before anything else happens.", "Retaliation claims are among the most expensive HR legal exposures."] },
  "Reduction in Force": { good: ["Proceed with separation meetings per your established RIF protocol and script.", "Ensure all severance agreements comply with applicable law, including OWBPA for employees over 40.", "Provide all required notices, benefits continuation information, and outplacement resources."], warn: ["Complete the adverse impact analysis before finalizing the selection list.", "Confirm WARN Act applicability with employment counsel before announcing dates.", "Ensure every selection decision has a documented, non-discriminatory business rationale."], risk: ["Do not proceed with any separations until employment counsel has signed off.", "The adverse impact analysis and legal review are not optional.", "WARN Act violations, adverse impact claims, and OWBPA defects all carry significant financial exposure."] },
  "Leave of Absence": { good: ["Provide all required leave paperwork within the legally required timeframe.", "Communicate clearly in writing about return-to-work expectations and the extension process.", "Document all leave-related conversations, approvals, and certifications."], warn: ["Identify the applicable leave type before taking any action.", "Do not count leave-protected absences in any attendance discipline or performance review.", "Consult HR on whether state leave laws provide protections beyond the federal minimum."], risk: ["Stop. Taking any action while leave protections are unconfirmed is high-risk.", "Escalate to HR today to identify all applicable leave laws and employer obligations.", "Legal review is required before any action — including denial of leave or attendance discipline."] }
};

function computeScore(qs, answers) {
  let wNo = 0, total = 0, crit = false, unk = 0, yes = 0, no = 0;
  qs.forEach((item, i) => {
    const a = answers[i]; total += item.weight;
    if (a === "yes") yes++;
    if (a === "no") { no++; wNo += item.weight; if (item.critical) crit = true; }
    if (a === "unknown") { unk++; wNo += item.weight * 0.75; if (item.critical) crit = true; }
  });
  const ratio = wNo / total;
  return { level: crit ? "risk" : ratio <= 0.15 ? "good" : ratio <= 0.45 ? "warn" : "risk", crit, unk, yes, no };
}

const C = {
  good: { bg: "rgba(52,211,153,0.1)", border: "rgba(52,211,153,0.3)", text: "#34d399", light: "#a7f3d0" },
  warn: { bg: "rgba(251,191,36,0.1)", border: "rgba(251,191,36,0.3)", text: "#fbbf24", light: "#fde68a" },
  risk: { bg: "rgba(251,113,133,0.1)", border: "rgba(251,113,133,0.3)", text: "#fb7185", light: "#fecdd3" },
};

export default function App() {
  const [step, setStep] = useState("pick");
  const [scenario, setScenario] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [notes, setNotes] = useState([]);
  const [hints, setHints] = useState([]);
  const [history, setHistory] = useState([]);
  const [copied, setCopied] = useState(false);

  const m = scenario ? META[scenario] : null;
  const qs = scenario ? QS[scenario] : [];
  const answered = answers.filter(a => a !== null).length;
  const allDone = qs.length > 0 && answered === qs.length;
  const sc = allDone ? computeScore(qs, answers) : null;

  const liveLevel = () => {
    if (!answered) return "neutral";
    return computeScore(qs, answers).level;
  };

  const pick = (name) => {
    setScenario(name); setStep("context");
    setAnswers([]); setNotes([]); setHints([]);
  };

  const start = () => {
    const n = QS[scenario].length;
    setAnswers(new Array(n).fill(null));
    setNotes(new Array(n).fill(""));
    setHints(new Array(n).fill(false));
    setStep("questions");
  };

  const ans = (idx, val) => {
    const next = [...answers]; next[idx] = val; setAnswers(next);
    if (next.every(a => a !== null)) {
      const { level } = computeScore(qs, next);
      setHistory(h => [{ scenario, level, time: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }) }, ...h]);
      setStep("result");
    }
  };

  const ll = liveLevel();
  const liveColors = { neutral: "#8899aa", good: "#34d399", warn: "#fbbf24", risk: "#fb7185" };
  const liveBg = { neutral: "rgba(255,255,255,0.04)", good: "rgba(52,211,153,0.08)", warn: "rgba(251,191,36,0.08)", risk: "rgba(251,113,133,0.08)" };
  const liveBorder = { neutral: "rgba(255,255,255,0.07)", good: "rgba(52,211,153,0.25)", warn: "rgba(251,191,36,0.25)", risk: "rgba(251,113,133,0.25)" };
  const liveMsgs = { neutral: "Answer each question to see your risk level update.", good: "Tracking as routine so far.", warn: "Some risk indicators present — finish all questions.", risk: "High-risk signals detected. Review carefully." };

  const s = {
    wrap: { fontFamily: "-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif", background: "linear-gradient(160deg,#020617 0%,#050d1f 50%,#020617 100%)", minHeight: "100vh", color: "#f8fafc", padding: "18px 16px 50px" },
    card: { background: "rgba(255,255,255,0.025)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 16, padding: "18px 20px", marginBottom: 20 },
    label: { fontSize: "0.7rem", letterSpacing: "0.08em", textTransform: "uppercase", color: "#8899aa", marginBottom: 10, display: "block" },
    grid: { display: "grid", gridTemplateColumns: "repeat(auto-fill,minmax(160px,1fr))", gap: 10, marginBottom: 22 },
    scard: (active) => ({ background: active ? "linear-gradient(135deg,rgba(34,193,255,0.12),rgba(110,231,183,0.07))" : "rgba(255,255,255,0.04)", border: `1px solid ${active ? "rgba(34,193,255,0.6)" : "rgba(255,255,255,0.07)"}`, borderRadius: 12, padding: "13px 12px", cursor: "pointer", display: "flex", flexDirection: "column", gap: 6, transition: "all .15s" }),
    badge: (level) => ({ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.05em", padding: "2px 7px", borderRadius: 5, width: "fit-content", textTransform: "uppercase", background: level === "high" ? "rgba(251,113,133,0.15)" : "rgba(251,191,36,0.12)", color: level === "high" ? "#fb7185" : "#fbbf24", border: `1px solid ${level === "high" ? "rgba(251,113,133,0.25)" : "rgba(251,191,36,0.25)"}` }),
    btn: (primary) => ({ padding: primary ? "10px 20px" : "8px 16px", borderRadius: 999, border: primary ? "1px solid rgba(34,193,255,0.45)" : "1px solid rgba(255,255,255,0.1)", background: primary ? "rgba(34,193,255,0.12)" : "rgba(255,255,255,0.04)", color: primary ? "#22c1ff" : "#f8fafc", cursor: "pointer", fontSize: "0.82rem", fontWeight: 600, fontFamily: "inherit" }),
  };

  const copySum = () => {
    if (!sc) return;
    const ll2 = sc.level === "good" ? "Low Risk" : sc.level === "warn" ? "Elevated Risk" : "High Risk";
    const lines = [`HR Action Sanity Check`, `Scenario: ${scenario}`, `Result: ${ll2}`, `Date: ${new Date().toLocaleDateString()}`, ""];
    qs.forEach((item, i) => {
      const a = answers[i]; const label = a === "yes" ? "Yes" : a === "no" ? "No" : "Don't know";
      lines.push(`Q${i + 1}${item.critical ? " [Critical]" : ""}: ${item.q}`, `  Answer: ${label}`);
      if (notes[i]) lines.push(`  Note: ${notes[i]}`);
      lines.push("");
    });
    const steps = STEPS[scenario][sc.level];
    lines.push("---", "Next steps:");
    steps.forEach((st, i) => lines.push(`${i + 1}. ${st}`));
    lines.push("", "General guidance only — not legal advice.");
    navigator.clipboard.writeText(lines.join("\n")).then(() => { setCopied(true); setTimeout(() => setCopied(false), 2000); });
  };

  return (
    <div style={s.wrap}>
      <div style={{ maxWidth: 840, margin: "0 auto" }}>
        {/* Header */}
        <div style={{ ...s.card, display: "flex", alignItems: "center", gap: 14 }}>
          <div style={{ width: 46, height: 46, flexShrink: 0, borderRadius: 12, background: "linear-gradient(135deg,#22c1ff,#6ee7b7)", display: "flex", alignItems: "center", justifyContent: "center", fontWeight: 800, fontSize: 15, color: "#02111a" }}>HR✓</div>
          <div>
            <div style={{ fontSize: "1.25rem", fontWeight: 700 }}>HR Action Sanity Check</div>
            <div style={{ fontSize: "0.83rem", color: "#8899aa", marginTop: 3 }}>A private confidence check for people-management decisions. Runs in your browser. Nothing is stored.</div>
          </div>
        </div>

        {/* Scenario grid */}
        <span style={s.label}>Step 1 — select your situation</span>
        <div style={s.grid}>
          {Object.keys(META).map(name => {
            const mm = META[name];
            return (
              <div key={name} style={s.scard(scenario === name)} onClick={() => pick(name)}>
                <div style={{ fontSize: "1.3rem" }}>{mm.icon}</div>
                <div style={{ fontSize: "0.85rem", fontWeight: 600, lineHeight: 1.25 }}>{name}</div>
                <div style={s.badge(mm.riskLevel)}>{mm.riskLabel}</div>
              </div>
            );
          })}
        </div>

        {/* Context panel */}
        {step !== "pick" && m && (
          <div style={{ ...s.card, marginBottom: 18 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 10 }}>
              <div style={{ fontSize: "1rem", fontWeight: 700 }}>{m.icon} {scenario}</div>
              <div style={s.badge(m.riskLevel)}>{m.riskLabel}</div>
            </div>
            <div style={{ fontSize: "0.88rem", color: "rgba(248,250,252,0.78)", lineHeight: 1.6, marginBottom: 14 }}>{m.description}</div>
            <div style={{ fontSize: "0.68rem", letterSpacing: "0.07em", textTransform: "uppercase", color: "#8899aa", marginBottom: 9 }}>Common examples</div>
            {m.examples.map((ex, i) => (
              <div key={i} style={{ display: "flex", gap: 9, background: "rgba(255,255,255,0.03)", border: "1px solid rgba(255,255,255,0.05)", borderRadius: 9, padding: "9px 12px", fontSize: "0.82rem", lineHeight: 1.5, color: "rgba(248,250,252,0.7)", marginBottom: 6 }}>
                <span>→</span><span>{ex}</span>
              </div>
            ))}
            <div style={{ background: "rgba(251,191,36,0.07)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 9, padding: "10px 13px", fontSize: "0.82rem", color: "rgba(251,191,36,0.9)", lineHeight: 1.5, margin: "14px 0 16px" }}>
              <strong>⚠ Watch for:</strong> {m.watch}
            </div>
            {step === "context" ? (
              <button style={s.btn(true)} onClick={start}>Start the check →</button>
            ) : (
              <button style={s.btn(false)} onClick={() => setStep("context")}>← Back to overview</button>
            )}
          </div>
        )}

        {/* Questions */}
        {(step === "questions" || step === "result") && (
          <div style={{ marginBottom: 18 }}>
            <span style={s.label}>Step 2 — {scenario} check</span>
            <div style={{ marginBottom: 14 }}>
              <div style={{ height: 3, background: "rgba(255,255,255,0.07)", borderRadius: 99, marginBottom: 5 }}>
                <div style={{ height: "100%", borderRadius: 99, background: "linear-gradient(90deg,#22c1ff,#6ee7b7)", width: `${qs.length ? (answered / qs.length) * 100 : 0}%`, transition: "width .3s" }} />
              </div>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: "0.74rem", color: "#8899aa" }}>
                <span>{answered} of {qs.length} answered</span>
                <span>{qs.length ? Math.round((answered / qs.length) * 100) : 0}%</span>
              </div>
            </div>
            <div style={{ display: "flex", alignItems: "center", gap: 8, padding: "8px 13px", borderRadius: 9, fontSize: "0.82rem", fontWeight: 600, marginBottom: 16, border: `1px solid ${liveBorder[ll]}`, background: liveBg[ll], color: liveColors[ll], transition: "all .25s" }}>
              <div style={{ width: 7, height: 7, borderRadius: "50%", background: "currentColor", flexShrink: 0 }} />
              {liveMsgs[ll]}
            </div>
            {qs.map((item, idx) => {
              const a = answers[idx];
              const rowBg = a === "yes" ? "rgba(52,211,153,0.06)" : a === "no" ? "rgba(251,113,133,0.06)" : a === "unknown" ? "rgba(251,191,36,0.05)" : "rgba(255,255,255,0.04)";
              const rowBorder = a === "yes" ? "rgba(52,211,153,0.28)" : a === "no" ? "rgba(251,113,133,0.28)" : a === "unknown" ? "rgba(251,191,36,0.22)" : "rgba(255,255,255,0.07)";
              return (
                <div key={idx} style={{ background: rowBg, border: `1px solid ${rowBorder}`, borderRadius: 11, padding: "13px 15px", marginBottom: 9, transition: "all .2s" }}>
                  <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: "0.68rem", color: "#8899aa", fontWeight: 600, marginBottom: 3, textTransform: "uppercase", letterSpacing: "0.04em" }}>Question {idx + 1} of {qs.length}</div>
                      <div style={{ fontSize: "0.88rem", lineHeight: 1.5, display: "flex", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                        {item.q}
                        {item.critical && <span style={{ fontSize: "0.62rem", fontWeight: 700, letterSpacing: "0.05em", textTransform: "uppercase", background: "rgba(251,113,133,0.12)", border: "1px solid rgba(251,113,133,0.3)", color: "#fb7185", borderRadius: 5, padding: "2px 6px", whiteSpace: "nowrap" }}>Critical</span>}
                      </div>
                      <button style={{ fontSize: "0.71rem", color: "rgba(34,193,255,0.65)", cursor: "pointer", marginTop: 5, background: "none", border: "none", fontFamily: "inherit", padding: 0 }}
                        onClick={() => { const h = [...hints]; h[idx] = !h[idx]; setHints(h); }}>
                        {hints[idx] ? "− Hide" : "+ Why this matters"}
                      </button>
                      {hints[idx] && <div style={{ fontSize: "0.77rem", color: "#8899aa", marginTop: 5, lineHeight: 1.45 }}>{item.hint}</div>}
                    </div>
                    <div style={{ display: "flex", gap: 5, flexShrink: 0 }}>
                      {[["Yes", "yes"], ["No", "no"], ["?", "unknown"]].map(([label, val]) => {
                        const on = a === val;
                        const onBg = val === "yes" ? "rgba(52,211,153,0.2)" : val === "no" ? "rgba(251,113,133,0.2)" : "rgba(251,191,36,0.15)";
                        const onBorder = val === "yes" ? "rgba(52,211,153,0.55)" : val === "no" ? "rgba(251,113,133,0.55)" : "rgba(251,191,36,0.45)";
                        const onColor = val === "yes" ? "#34d399" : val === "no" ? "#fb7185" : "#fbbf24";
                        return (
                          <button key={val} title={val === "unknown" ? "Don't know" : undefined}
                            style={{ padding: "5px 12px", borderRadius: 999, border: `1px solid ${on ? onBorder : "rgba(255,255,255,0.1)"}`, background: on ? onBg : "transparent", color: on ? onColor : "#f8fafc", cursor: "pointer", fontWeight: 600, fontSize: "0.77rem", minWidth: 46, fontFamily: "inherit" }}
                            onClick={() => ans(idx, val)}>{label}</button>
                        );
                      })}
                    </div>
                  </div>
                  {a !== null && (
                    <textarea rows={2} placeholder="Add context or notes (optional)..."
                      style={{ width: "100%", marginTop: 9, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)", borderRadius: 7, padding: "7px 10px", color: "#f8fafc", fontSize: "0.79rem", fontFamily: "inherit", resize: "none", outline: "none" }}
                      value={notes[idx] || ""} onChange={e => { const n = [...notes]; n[idx] = e.target.value; setNotes(n); }} />
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Result */}
        {step === "result" && sc && (() => {
          const col = C[sc.level];
          const steps = STEPS[scenario][sc.level];
          const titles = { good: "Routine management action — proceed carefully.", warn: "Elevated risk — pause and address gaps before acting.", risk: "High risk — do not proceed without HR or legal review." };
          const summaries = { good: "Your answers indicate this situation is within standard management scope. Document each step you take.", warn: "One or more answers reveal gaps in process, documentation, or legal review. Resolve these before taking action.", risk: "Critical risk factors are present. Acting without HR or legal involvement exposes you and the organization significantly." };
          const labels = { good: "Low Risk", warn: "Elevated Risk", risk: "High Risk" };
          const dn = qs.length - sc.yes - sc.no;
          return (
            <div>
              <span style={s.label}>Assessment</span>
              {sc.crit && <div style={{ background: "rgba(251,113,133,0.08)", border: "1px solid rgba(251,113,133,0.35)", borderRadius: 11, padding: "12px 14px", fontSize: "0.84rem", color: "rgba(253,205,211,0.9)", lineHeight: 1.55, marginBottom: 11 }}><strong>Critical question not confirmed.</strong> One or more questions marked Critical were answered No or Don't Know. These carry significant legal exposure. HR and legal review is required before any action.</div>}
              {sc.unk > 0 && <div style={{ background: "rgba(251,191,36,0.06)", border: "1px solid rgba(251,191,36,0.2)", borderRadius: 10, padding: "10px 13px", fontSize: "0.82rem", color: "rgba(253,230,138,0.85)", lineHeight: 1.5, marginBottom: 11 }}>{sc.unk} question{sc.unk > 1 ? "s were" : " was"} answered "Don't know." Uncertainty is a risk signal and has been factored into the score.</div>}
              <div style={{ background: col.bg, border: `1px solid ${col.border}`, borderRadius: 14, padding: "18px 20px", marginBottom: 12 }}>
                <div style={{ fontSize: "0.68rem", letterSpacing: "0.09em", textTransform: "uppercase", fontWeight: 700, color: col.text, marginBottom: 4, opacity: 0.85 }}>{labels[sc.level]}</div>
                <div style={{ fontSize: "1rem", fontWeight: 700, color: col.light, marginBottom: 6 }}>{titles[sc.level]}</div>
                <div style={{ fontSize: "0.86rem", lineHeight: 1.6, opacity: 0.84, marginBottom: 14 }}>{summaries[sc.level]}</div>
                <div style={{ fontSize: "0.68rem", letterSpacing: "0.07em", textTransform: "uppercase", color: "#8899aa", marginBottom: 9 }}>Recommended next steps</div>
                {steps.map((st, i) => (
                  <div key={i} style={{ display: "flex", alignItems: "flex-start", gap: 9, fontSize: "0.84rem", lineHeight: 1.5, padding: "8px 11px", background: "rgba(255,255,255,0.04)", borderRadius: 8, border: "1px solid rgba(255,255,255,0.06)", marginBottom: 6 }}>
                    <span style={{ fontSize: "0.68rem", fontWeight: 700, width: 18, height: 18, borderRadius: "50%", display: "flex", alignItems: "center", justifyContent: "center", flexShrink: 0, marginTop: 1, background: `${col.text}22`, color: col.text }}>{i + 1}</span>
                    <span>{st}</span>
                  </div>
                ))}
              </div>
              <div style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 11, padding: "14px 16px", marginBottom: 12 }}>
                <div style={{ fontSize: "0.68rem", letterSpacing: "0.07em", textTransform: "uppercase", color: "#8899aa", marginBottom: 10 }}>Answer breakdown</div>
                {[["Yes", sc.yes, "#34d399"], ["No", sc.no, "#fb7185"], ["Don't know", dn, "#fbbf24"]].map(([label, count, color]) => (
                  <div key={label} style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 7 }}>
                    <div style={{ fontSize: "0.78rem", width: 90, flexShrink: 0, color: "rgba(248,250,252,0.7)" }}>{label}</div>
                    <div style={{ flex: 1, height: 5, background: "rgba(255,255,255,0.07)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", background: color, borderRadius: 99, width: `${qs.length ? (count / qs.length) * 100 : 0}%`, transition: "width .4s" }} />
                    </div>
                    <div style={{ fontSize: "0.77rem", color: "#8899aa", width: 20, textAlign: "right" }}>{count}</div>
                  </div>
                ))}
              </div>
              <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                <button style={s.btn(true)} onClick={start}>Run again</button>
                <button style={s.btn(false)} onClick={() => { setScenario(null); setStep("pick"); }}>New situation</button>
                <button style={s.btn(false)} onClick={copySum}>{copied ? "Copied!" : "Copy summary"}</button>
              </div>
            </div>
          );
        })()}

        {/* History */}
        {history.length > 0 && (
          <div style={{ marginTop: 24, borderTop: "1px solid rgba(255,255,255,0.07)", paddingTop: 18 }}>
            <span style={s.label}>Session history</span>
            {history.map((e, i) => (
              <div key={i} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 12, background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)", borderRadius: 9, padding: "9px 13px", fontSize: "0.82rem", marginBottom: 6 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                  <div style={{ width: 7, height: 7, borderRadius: "50%", background: C[e.level].text, flexShrink: 0 }} />
                  <div>
                    <div style={{ fontWeight: 600 }}>{META[e.scenario].icon} {e.scenario}</div>
                    <div style={{ fontSize: "0.72rem", color: "#8899aa" }}>{e.time}</div>
                  </div>
                </div>
                <div style={{ fontSize: "0.65rem", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", padding: "2px 7px", borderRadius: 4, background: C[e.level].bg, color: C[e.level].text }}>{e.level === "good" ? "Low Risk" : e.level === "warn" ? "Elevated" : "High Risk"}</div>
              </div>
            ))}
          </div>
        )}

        <div style={{ marginTop: 28, textAlign: "center", fontSize: "0.74rem", color: "#8899aa", lineHeight: 1.6 }}>
          General guidance only — not legal advice.<br />Built to support everyday people-management decisions. 
        </div>
      </div>
    </div>
  );
}
