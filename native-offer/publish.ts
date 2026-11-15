import { accountOnForm } from "../shared/offer-form";
import { preparationAccountMatches } from "../shared/offer-panel";
import { visibleMarketplaceControl } from "../shared/marketplace-notices";
import { publishControl } from "../shared/publication";

export function publicationProblem(root: Document) {
  const text = root.body.innerText.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
  if (text.includes("publicarea anunturilor este posibila doar cu un numar de telefon confirmat"))
    return "999.md requires a confirmed phone number on this account before publishing. Verify it on 999.md, then continue.";
  const errors = Array.from(root.querySelectorAll<HTMLElement>('[role="alert"], [aria-invalid="true"]')).filter(visibleMarketplaceControl);
  return errors.map(e => e.textContent?.trim()).filter(Boolean).join(" ").slice(0, 500);
}

/** One submission of the inspected free creator action. Never retries or buys services. */
export function automaticPublisher(
  root: Document,
  expectedLogin: string,
  arm: () => void,
  href: () => string = () => location.href,
) {
  let attempted = false;
  return () => {
    if (attempted) throw Error("Publication was already attempted. Check 999.md before trying again.");
    const url = new URL(href());
    if (url.origin !== "https://999.md" || !/^\/(ro|ru)\/add$/.test(url.pathname))
      throw Error("Publication requires the official 999.md creator.");
    if (!expectedLogin || expectedLogin.includes("@") || !preparationAccountMatches(expectedLogin, accountOnForm(root)))
      throw Error("The connected marketplace account changed. Review before publishing.");
    const text = root.body.innerText.normalize("NFKD").replace(/\p{M}/gu, "").toLowerCase();
    // 999.md switches to singular wording for the final free placement.
    // Text split across inline elements can also introduce line breaks/spaces.
    const free = [...text.matchAll(/\bau ramas\s+(\d+)\s+(?:anunt\s+gratuit|anunturi\s+gratuite)\b/g)];
    if (!free.length || free.some(match => Number(match[1]) < 1))
      throw Error("A free placement could not be verified. Review the marketplace before continuing.");
    if (Array.from(root.querySelectorAll<HTMLElement>('[role="dialog"], [aria-modal="true"]')).some(visibleMarketplaceControl))
      throw Error("Close the marketplace dialog before publishing.");
    const buttons = Array.from(root.querySelectorAll<HTMLButtonElement>('button,input[type="submit"]')).filter(button =>
      !button.disabled && button.getAttribute("aria-disabled") !== "true" && visibleMarketplaceControl(button) &&
      publishControl(button.textContent || button.getAttribute("value") || button.getAttribute("aria-label") || ""));
    if (buttons.length !== 1) throw Error("The marketplace has no unique enabled Publish control. Review the form.");
    const problem = publicationProblem(root);
    if (problem) throw Error(problem);
    attempted = true;
    arm();
    buttons[0].click();
  };
}
