// The SOP register from the SWD Business OS Document Pack (06_SOP_Manual).
// Procedures the pack wrote out are loaded as DRAFT version 1 and still need
// owner approval; the rest are registered with no text — nothing is invented.

export type SeedSop = {
  sopId: string; title: string; ownerRole: string; applicable: string[];
  draft?: { purpose: string; steps: string[]; exceptions?: string; records?: string };
};

const ALL = ["OWNER", "MANAGER", "CASHIER", "TECHNICIAN"];

export const SOP_SEED: SeedSop[] = [
  { sopId: "SOP-001", title: "Opening the shop", ownerRole: "Manager", applicable: ["OWNER", "MANAGER", "CASHIER"], draft: {
    purpose: "Ensure the shop opens safely and is ready for trading.",
    steps: ["Arrive at the scheduled time.", "Check doors, locks and visible signs of damage.", "Report security concerns before trading.", "Switch on approved equipment.", "Log in using your own account.", "Check internet and POS connectivity.", "Review pending sync transactions and unresolved alerts.", "Count opening float with a second person where required.", "Open cash session and record float.", "Check high-value stock and display condition.", "Confirm the shop is ready to serve customers."],
    records: "Opening checklist, cash session, incident report if required." } },
  { sopId: "SOP-002", title: "Closing the shop", ownerRole: "Manager", applicable: ["OWNER", "MANAGER", "CASHIER"], draft: {
    purpose: "Close the day with every sale, cash movement and variance accounted for.",
    steps: ["Stop new transactions at approved closing time.", "Review POS transactions.", "Check pending offline synchronisation.", "Verify payment records and references.", "Count physical cash.", "Reconcile cash movements.", "Reconcile mobile-money and bank/card collections.", "Record refunds and expenses.", "Calculate expected closing balance.", "Enter actual balance.", "Explain every variance.", "Submit closing report.", "Obtain manager review.", "Secure cash and stock.", "Lock premises and record close time."],
    exceptions: "A closed reconciliation must not be silently edited. Corrections require a traceable adjustment." } },
  { sopId: "SOP-003", title: "Customer service", ownerRole: "Manager", applicable: ["OWNER", "MANAGER", "CASHIER"] },
  { sopId: "SOP-004", title: "Processing a sale", ownerRole: "Cashier", applicable: ["OWNER", "MANAGER", "CASHIER"], draft: {
    purpose: "Record every sale accurately, with the right price, payment and receipt.",
    steps: ["Identify product and confirm variant.", "Confirm selling price.", "Search for existing customer or use walk-in option.", "Add items and quantities to POS.", "Apply discount only within permission.", "Confirm total with customer.", "Select payment method.", "Verify payment using approved process.", "Complete transaction.", "Issue receipt.", "Confirm stock update.", "Thank customer."],
    exceptions: "If payment is uncertain, leave it pending/unverified and escalate. Do not mark it paid based only on a screenshot or typed reference." } },
  { sopId: "SOP-005", title: "Receiving stock", ownerRole: "Manager", applicable: ["OWNER", "MANAGER"], draft: {
    purpose: "Check delivered goods against the purchase order and record exactly what was accepted.",
    steps: ["Locate approved purchase order.", "Compare delivered goods with order.", "Count each item.", "Inspect condition.", "Record accepted and rejected quantities separately.", "Attach supplier invoice/delivery note.", "Submit receipt.", "Confirm inventory movement.", "Escalate shortages, substitutions and damaged items.", "Update supplier issue record."] } },
  { sopId: "SOP-006", title: "Stock adjustments", ownerRole: "Manager", applicable: ["OWNER", "MANAGER"] },
  { sopId: "SOP-007", title: "Purchasing products", ownerRole: "Owner/Manager", applicable: ["OWNER", "MANAGER"] },
  { sopId: "SOP-008", title: "Cash handling", ownerRole: "Manager", applicable: ["OWNER", "MANAGER", "CASHIER"], draft: {
    purpose: "Keep shop cash secure, traceable and tied to individual accounts.",
    steps: ["Use individual accounts and assigned cash sessions.", "Record all cash receipts and approved cash movements.", "Never use shop cash for personal spending.", "Record expenses with reason and evidence.", "Keep cash secure.", "Report suspected counterfeit notes or discrepancies.", "Do not share cash-session credentials."] } },
  { sopId: "SOP-009", title: "Mobile-money verification", ownerRole: "Manager", applicable: ["OWNER", "MANAGER", "CASHIER"], draft: {
    purpose: "Confirm mobile-money payments independently before treating them as received.",
    steps: ["Identify expected amount and transaction.", "Use the approved merchant statement/provider channel or verified integration.", "Match amount, currency, reference and status.", "Check that the reference has not already been used.", "Record verifier and timestamp.", "Mark verified only after confirmation.", "Escalate missing, reversed or mismatched payments."],
    exceptions: "A customer screenshot or SMS displayed by the customer is not sufficient by itself unless the business has an approved independent verification process." } },
  { sopId: "SOP-010", title: "Daily cash reconciliation", ownerRole: "Manager", applicable: ["OWNER", "MANAGER"] },
  { sopId: "SOP-011", title: "Customer registration", ownerRole: "Cashier", applicable: ["OWNER", "MANAGER", "CASHIER"] },
  { sopId: "SOP-012", title: "Returns and refunds", ownerRole: "Manager", applicable: ["OWNER", "MANAGER", "CASHIER"] },
  { sopId: "SOP-013", title: "Device repair intake", ownerRole: "Cashier/Manager", applicable: ["OWNER", "MANAGER", "CASHIER"], draft: {
    purpose: "Book a device in with a clear record of its condition and the customer's reported fault.",
    steps: ["Create repair ticket.", "Verify customer contact.", "Record device make/model and identifier where appropriate.", "Record reported fault in the customer's words.", "Inspect and document external condition with customer present.", "Record accessories received.", "Take intake photographs with consent.", "Record any existing damage.", "Explain diagnostic and quotation process.", "Give customer a ticket/reference.", "Store device securely."],
    exceptions: "Do not request or record device passwords unless strictly necessary for an authorised diagnostic process. Prefer customer-assisted unlock or a temporary test arrangement that avoids retaining credentials." } },
  { sopId: "SOP-014", title: "Repair coordination", ownerRole: "Repair coordinator", applicable: ["OWNER", "MANAGER"], draft: {
    purpose: "Move each repair from assignment to closure with customer approval before paid work.",
    steps: ["Assign approved technician.", "Record agreed technician price and target date.", "Obtain diagnosis.", "Prepare customer quotation.", "Obtain customer approval before paid work.", "Record parts and labour.", "Monitor progress and delays.", "Perform or arrange quality check.", "Confirm repair result.", "Notify customer.", "Record payment and technician settlement.", "Close ticket after collection."] } },
  { sopId: "SOP-015", title: "Repair quality assurance", ownerRole: "Technician/Manager", applicable: ["OWNER", "MANAGER", "TECHNICIAN"], draft: {
    purpose: "Confirm a repaired device is fixed and undamaged before it is released.",
    steps: ["Check the original reported fault.", "Check relevant device functions.", "Check physical condition.", "Check parts fit and finish.", "Check charging/connectivity where relevant.", "Check customer data/device integrity.", "Check repair notes and warranty.", "Check technician completion evidence.", "Record pass/fail and corrective action."] } },
  { sopId: "SOP-016", title: "Device collection", ownerRole: "Cashier", applicable: ["OWNER", "MANAGER", "CASHIER"], draft: {
    purpose: "Hand a repaired device to the right person, paid for and with warranty terms explained.",
    steps: ["Verify ticket and customer identity using proportionate checks.", "Demonstrate agreed repair outcome.", "Confirm charges and payment status.", "Explain warranty limitations and period.", "Obtain collection acknowledgement.", "Record collection date and employee.", "Return all accessories received.", "Close ticket."] } },
  { sopId: "SOP-017", title: "Customer data protection", ownerRole: "All staff", applicable: ALL },
  { sopId: "SOP-018", title: "Staff account security", ownerRole: "All staff", applicable: ALL },
  { sopId: "SOP-019", title: "Offline POS operation", ownerRole: "Cashier", applicable: ["OWNER", "MANAGER", "CASHIER"] },
  { sopId: "SOP-020", title: "Weekly performance reporting", ownerRole: "Manager", applicable: ["OWNER", "MANAGER"] },
];
