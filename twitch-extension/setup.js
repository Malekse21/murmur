(function () {
  var helper = window.Twitch && window.Twitch.ext;
  var status = document.getElementById("setup-status");
  var link = document.getElementById("dashboard-link");
  var config = window.MURMUR_EXTENSION_CONFIG || {};
  var base = (config.apiBaseUrl || window.location.origin).replace(/\/+$/, "");
  if (link) link.href = config.dashboardUrl || base + "/dashboard";
  if (!helper || !status) return;

  helper.onAuthorized(function (auth) {
    fetch(base + "/api/extension/state", {
      headers: { Authorization: "Bearer " + auth.token },
      cache: "no-store",
    }).then(function (response) {
      if (!response.ok) throw new Error("Could not verify the channel.");
      return response.json();
    }).then(function (result) {
      status.textContent = result.ready
        ? "MurMur is connected to this channel. Activate the extension to show your mascot."
        : "Connect this broadcaster account in MurMur, then return here to activate the extension.";
    }).catch(function () {
      status.textContent = "MurMur could not reach its backend. Check the extension backend URL and try again.";
    });
  });
})();
