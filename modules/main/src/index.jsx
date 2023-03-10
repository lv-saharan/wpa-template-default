import { Security } from "/modules/common/index.js";
import { h, render, setTheme } from "wpa";
import { css } from "wpa-ui";

import indexCSS from "./index.scss";
import themeCSS from "./theme.scss";

setTheme(themeCSS);

(async () => {
  const indexCSSStyleSheet = new CSSStyleSheet();
  indexCSSStyleSheet.replace(indexCSS);

  const rootCSSStyleSheet = await css.getCSSStyleSheet("root");
  document.adoptedStyleSheets = [rootCSSStyleSheet, indexCSSStyleSheet];

  let key = "auth";
  let module = "login";
  if (Security.isLogined) {
    key = "home";
    module = "default";
  }
  let rootNode = await render(
    <wp-import
      src={new URL(`../${key}/index.js`, import.meta.url).href}
      module={module}
    ></wp-import>,
    "body"
  );

  Security.onLogin(() => {
    key = "home";
    module = "default";
    rootNode.load(new URL(`../${key}/index.js`, import.meta.url).href, module);
  }).onLogout((_) => {
    const url = new URL("../../", import.meta.url).href;
    location.href = url;
  });
})();
