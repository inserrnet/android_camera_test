(function () {
  "use strict";

  if (window.__cameraRequestMonitorInstalled) {
    return;
  }
  window.__cameraRequestMonitorInstalled = true;

  var state = {
    requested: null,
    selected: null,
    lastEvent: "Waiting for camera request"
  };

  var hostId = "__camera_request_monitor_host";
  var host = document.getElementById(hostId);
  var shadow;
  var content;
  var panelClosed = false;

  function text(value) {
    if (value === undefined || value === null || value === "") {
      return "not specified";
    }
    return String(value);
  }

  function formatConstraint(value) {
    if (value === undefined || value === null) {
      return "not specified";
    }
    if (typeof value !== "object") {
      return text(value);
    }

    var parts = [];
    ["min", "exact", "ideal", "max"].forEach(function (key) {
      if (Object.prototype.hasOwnProperty.call(value, key)) {
        parts.push(key + ": " + text(value[key]));
      }
    });

    if (parts.length === 0) {
      return JSON.stringify(value);
    }
    return parts.join(", ");
  }

  function normalizeVideoConstraints(constraints) {
    if (!constraints || constraints.video === false || constraints.video === undefined) {
      return null;
    }
    if (constraints.video === true) {
      return {
        width: "not specified",
        height: "not specified",
        frameRate: "not specified",
        facingMode: "not specified"
      };
    }

    var video = constraints.video || {};
    return {
      width: formatConstraint(video.width),
      height: formatConstraint(video.height),
      frameRate: formatConstraint(video.frameRate),
      facingMode: formatConstraint(video.facingMode)
    };
  }

  function settingsFromTrack(track) {
    if (!track || typeof track.getSettings !== "function") {
      return null;
    }
    var settings = track.getSettings();
    return {
      width: settings.width,
      height: settings.height,
      frameRate: settings.frameRate,
      facingMode: settings.facingMode
    };
  }

  function ensurePanel() {
    if (content && document.body && document.body.contains(host)) {
      return;
    }

    host = document.getElementById(hostId);
    if (!host) {
      host = document.createElement("div");
      host.id = hostId;
      document.documentElement.appendChild(host);
    }

    if (!host.shadowRoot) {
      shadow = host.attachShadow({ mode: "open" });
    } else {
      shadow = host.shadowRoot;
    }
    shadow.textContent = "";

    var style = document.createElement("style");
    style.textContent = [
      ":host{all:initial;}",
      ".panel{position:fixed;right:12px;top:72px;z-index:2147483647;max-width:min(340px,calc(100vw - 24px));",
      "font:12px/1.35 -apple-system,BlinkMacSystemFont,Segoe UI,Roboto,Arial,sans-serif;color:#e5e7eb;",
      "background:rgba(15,23,42,.94);border:1px solid rgba(148,163,184,.28);border-radius:10px;",
      "box-shadow:0 12px 34px rgba(2,6,23,.34);padding:10px 12px;box-sizing:border-box;}",
      ".top{display:flex;align-items:center;gap:10px;margin-bottom:8px;}",
      ".title{font-weight:700;font-size:13px;letter-spacing:0;flex:1;color:#f8fafc;}",
      "button{width:24px;height:24px;border:0;border-radius:999px;background:#334155;color:#f8fafc;font-size:16px;line-height:20px;cursor:pointer;}",
      ".section{margin-top:9px;padding-top:8px;border-top:1px solid rgba(148,163,184,.22);}",
      ".heading{font-size:10px;color:#93c5fd;font-weight:700;margin-bottom:5px;}",
      ".row{display:grid;grid-template-columns:92px minmax(0,1fr);gap:8px;margin:2px 0;}",
      ".label{color:#cbd5e1;}",
      ".value{color:#f8fafc;overflow-wrap:anywhere;}",
      ".muted{color:#94a3b8;}"
    ].join("");

    var panel = document.createElement("div");
    panel.className = "panel";

    var top = document.createElement("div");
    top.className = "top";
    var title = document.createElement("div");
    title.className = "title";
    title.textContent = "Camera Monitor";
    var close = document.createElement("button");
    close.type = "button";
    close.textContent = "\u00d7";
    close.addEventListener("click", function () {
      panelClosed = true;
      if (host && host.parentNode) {
        host.parentNode.removeChild(host);
      }
    });
    top.appendChild(title);
    top.appendChild(close);

    content = document.createElement("div");
    panel.appendChild(top);
    panel.appendChild(content);
    shadow.appendChild(style);
    shadow.appendChild(panel);
  }

  function addSection(parent, headingText, rows, emptyText) {
    var section = document.createElement("div");
    section.className = "section";
    var heading = document.createElement("div");
    heading.className = "heading";
    heading.textContent = headingText;
    section.appendChild(heading);

    if (!rows) {
      var empty = document.createElement("div");
      empty.className = "muted";
      empty.textContent = emptyText || "not available";
      section.appendChild(empty);
    } else {
      rows.forEach(function (row) {
        var line = document.createElement("div");
        line.className = "row";
        var label = document.createElement("div");
        label.className = "label";
        label.textContent = row[0];
        var value = document.createElement("div");
        value.className = "value";
        value.textContent = row[1];
        line.appendChild(label);
        line.appendChild(value);
        section.appendChild(line);
      });
    }

    parent.appendChild(section);
  }

  function render() {
    if (panelClosed) {
      return;
    }
    if (!document.documentElement) {
      return;
    }
    ensurePanel();
    content.textContent = "";

    var requestedRows = state.requested ? [
      ["Width", state.requested.width],
      ["Height", state.requested.height],
      ["Frame rate", state.requested.frameRate],
      ["Facing mode", state.requested.facingMode]
    ] : null;

    var selectedRows = state.selected ? [
      ["Resolution", text(state.selected.width) + " \u00d7 " + text(state.selected.height)],
      ["Frame rate", text(state.selected.frameRate)],
      ["Facing mode", text(state.selected.facingMode)]
    ] : null;

    addSection(content, "REQUESTED BY PAGE", requestedRows, "no video request");
    addSection(content, "SELECTED BY BROWSER", selectedRows, "waiting for video track");
    addSection(content, "LAST EVENT", [["", state.lastEvent]]);
  }

  function update(next) {
    Object.keys(next).forEach(function (key) {
      state[key] = next[key];
    });
    render();
  }

  function wrapApplyConstraints(track) {
    if (!track || track.__cameraRequestMonitorApplyWrapped || typeof track.applyConstraints !== "function") {
      return;
    }

    var originalApplyConstraints = track.applyConstraints.bind(track);
    Object.defineProperty(track, "__cameraRequestMonitorApplyWrapped", {
      value: true,
      configurable: false
    });

    track.applyConstraints = function (constraints) {
      var requested = normalizeVideoConstraints({ video: constraints || true });
      if (requested) {
        update({
          requested: requested,
          lastEvent: "applyConstraints() called"
        });
      } else {
        update({ lastEvent: "applyConstraints() called" });
      }

      return originalApplyConstraints(constraints).then(function (result) {
        update({
          selected: settingsFromTrack(track),
          lastEvent: "Video track active"
        });
        return result;
      }, function (error) {
        update({ lastEvent: "applyConstraints() failed" });
        throw error;
      });
    };

    track.addEventListener("ended", function () {
      update({ lastEvent: "Video track ended" });
    });
  }

  function installGetUserMediaWrapper() {
    if (!navigator.mediaDevices || typeof navigator.mediaDevices.getUserMedia !== "function") {
      render();
      return;
    }

    var originalGetUserMedia =
      navigator.mediaDevices.getUserMedia.bind(
        navigator.mediaDevices
      );

    navigator.mediaDevices.getUserMedia = function (constraints) {
      var requested = normalizeVideoConstraints(constraints || {});
      update({
        requested: requested,
        selected: null,
        lastEvent: "getUserMedia() called"
      });

      return originalGetUserMedia(constraints).then(function (stream) {
        var track = stream && typeof stream.getVideoTracks === "function" ? stream.getVideoTracks()[0] : null;
        if (track) {
          wrapApplyConstraints(track);
          update({
            selected: settingsFromTrack(track),
            lastEvent: "Video track active"
          });
        }
        return stream;
      }, function (error) {
        update({ lastEvent: "getUserMedia() failed" });
        throw error;
      });
    };

    render();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", render, { once: true });
  } else {
    render();
  }

  installGetUserMediaWrapper();
}());
