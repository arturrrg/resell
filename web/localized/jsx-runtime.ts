import { createContext, useContext, type ReactNode, type ElementType } from "react";
import { jsx as reactJsx, jsxs as reactJsxs, Fragment } from "react/jsx-runtime";
import { useLanguage, translate } from "../i18n";
export { Fragment };
export type { JSX } from "react/jsx-runtime";

// Localize at React's text/attribute boundary. Values, event handlers, keys,
// refs, URLs and marketplace payloads keep their original identity.
const PreserveText = createContext(false);
const hosts = new Map<string, ElementType>();
const attributes = ["title", "aria-label", "aria-description", "aria-valuetext", "placeholder", "alt"];
function localizedHost(tag: string) {
  let component = hosts.get(tag);
  if (component) return component;
  component = function LocalizedHost(props: Record<string, any>) {
    const language = useLanguage();
    const inherited = useContext(PreserveText);
    const preserve = props.translate === "no" || (props.translate !== "yes" && inherited);
    const skip = preserve || tag === "script" || tag === "style" || props.contentEditable;
    const next = { ...props };
    const staticChildren = next.__resellStaticChildren;
    delete next.__resellStaticChildren;
    if (!skip) {
      for (const name of attributes) if (typeof next[name] === "string") next[name] = translate(next[name], language);
      const text = (child: ReactNode): ReactNode => typeof child === "string" ? translate(child, language) : Array.isArray(child) ? child.map(text) : child;
      if (tag !== "textarea") next.children = text(props.children);
      // An option without an explicit value uses its text as its value in HTML.
      if (tag === "option" && props.value === undefined && typeof props.children === "string") next.value = props.children;
    }
    const element = (staticChildren ? reactJsxs : reactJsx)(tag as ElementType, next);
    return preserve === inherited ? element : reactJsx(PreserveText.Provider, { value: preserve, children: element });
  };
  hosts.set(tag, component);
  return component;
}
export const jsx: typeof reactJsx = (type, props, key) => reactJsx(typeof type === "string" ? localizedHost(type) : type, props, key);
export const jsxs: typeof reactJsxs = (type, props, key) => typeof type === "string" ? reactJsxs(localizedHost(type), { ...(props as object), __resellStaticChildren: true }, key) : reactJsxs(type, props, key);
