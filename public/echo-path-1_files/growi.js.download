function setCookie(name, value, days) {
  let expires = "";
  if (days) {
    const date = new Date();
    date.setTime(date.getTime() + days * 24 * 60 * 60 * 1000);
    expires = "; expires=" + date.toUTCString();
  }
  document.cookie = name + "=" + (value || "") + expires + "; path=/";
}

function getCookie(name) {
  const nameEQ = name + "=";
  const ca = document.cookie.split(";");
  for (let i = 0; i < ca.length; i++) {
    let c = ca[i];
    while (c.charAt(0) === " ") c = c.substring(1, c.length);
    if (c.indexOf(nameEQ) === 0) return c.substring(nameEQ.length, c.length);
  }
  return null;
}

function setAffiliateCode(cookieName) {
  const affiliateCode = getCookie(cookieName);
  if (!window.growi) {
    window.growi = {};
  }
  window.growi.affiliate_code = affiliateCode;
  const event = new Event("affiliateCodeChange");
  window.dispatchEvent(event);
}

function getQueryParam(name) {
  const urlParams = new URLSearchParams(window.location.search);
  return urlParams.get(name);
}

function script() {
  const scriptTag = document.currentScript;
  const organizationId = scriptTag.getAttribute("data-growi");

  if (!organizationId) {
    throw new Error(
      "Growi Integration Error: Please provide data-growi-id on the script tag"
    );
  }

  const cookieName =
    scriptTag.getAttribute("data-growi-cookie-name") || "growi-affiliate-code";
  const affiliateCode = getQueryParam(
    scriptTag.getAttribute("data-growi-affiliate-param") || "a"
  );

  if (affiliateCode) {
    setCookie(cookieName, affiliateCode, 30);
  }
  setAffiliateCode(cookieName);
}
script();
