/**
 * Deliberately disabled legacy deployment entrypoint.
 *
 * The canonical ABCD model has 1B supply split across eight allocations and
 * does not designate an ICO inventory. Running a historical sale deployer
 * would recreate obsolete wallet and supply assumptions. A future ICO needs
 * an explicit, separately approved allocation and sale specification.
 */
throw new Error(
  "deploy-ico.ts is disabled: the approved 1B/eight-allocation model has no ICO allocation. Use an explicitly approved future sale deployment instead.",
);
