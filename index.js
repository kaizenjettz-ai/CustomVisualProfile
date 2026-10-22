module.exports = (vendetta) => {
  const { patcher, metro, ui, storage, logger } = vendetta;
  const { findByProps, findByName } = metro;
  const { React, toasts } = ui;

  const settings = storage.createStorage("CustomVisualProfile");
  if (typeof settings.customName !== "string") settings.customName = "";
  if (!Array.isArray(settings.badges)) settings.badges = [];

  const unpatches = [];

  // ===== USERNAME =====
  try {
    const UserStore = findByProps("getCurrentUser", "getUser");
    if (UserStore && UserStore.getUser) {
      unpatches.push(
        patcher.instead(UserStore, "getUser", (args, orig) => {
          const user = orig(...args);
          try {
            const me = UserStore.getCurrentUser && UserStore.getCurrentUser();
            if (user && me && user.id === me.id && settings.customName && settings.customName.trim()) {
              return new Proxy(user, {
                get(target, prop) {
                  if (prop === "username" || prop === "globalName" || prop === "displayName") {
                    return settings.customName;
                  }
                  return Reflect.get(target, prop);
                }
              });
            }
          } catch (e) {}
          return user;
        })
      );
    }
  } catch (e) {
    logger.log("Username error", e);
  }

  // ===== BADGES =====
  try {
    let ProfileBadges = findByName("ProfileBadges");
    if (!ProfileBadges) ProfileBadges = findByName("ProfileBadges", { default: false });

    if (ProfileBadges) {
      const method = ProfileBadges.default ? "default" : undefined;
      unpatches.push(
        patcher.after(ProfileBadges, method, (args, res) => {
          try {
            const user = args && args[0] && args[0].user;
            const UserStore = findByProps("getCurrentUser");
            const me = UserStore && UserStore.getCurrentUser && UserStore.getCurrentUser();

            if (!user || !me || user.id !== me.id) return res;
            if (!settings.badges || settings.badges.length === 0) return res;

            const badges = settings.badges
              .filter(b => b && b.url)
              .map((b, i) => React.createElement("Image", {
                key: "cvp" + i,
                source: { uri: b.url },
                style: { width: 18, height: 18, marginLeft: 4 },
                resizeMode: "contain"
              }));

            if (res && res.props && Array.isArray(res.props.children)) {
              res.props.children = res.props.children.concat(badges);
            }
          } catch (e) {}
          return res;
        })
      );
    }
  } catch (e) {
    logger.log("Badge error", e);
  }

  // ===== SETTINGS (very simple) =====
  function Settings() {
    const [name, setName] = React.useState(settings.customName || "");
    const [url, setUrl] = React.useState("");

    return React.createElement("View", { style: { padding: 16 } },
      React.createElement("Text", { style: { color: "white", fontSize: 16, marginBottom: 8 } }, "Custom Username"),
      React.createElement("TextInput", {
        style: { backgroundColor: "#2f3136", color: "white", padding: 10, borderRadius: 6, marginBottom: 10 },
        value: name,
        onChangeText: setName,
        placeholder: "Type a name..."
      }),
      React.createElement("Text", {
        style: { color: "#5865F2", marginBottom: 20 },
        onPress: () => {
          settings.customName = name.trim();
          toasts.showToast(name.trim() ? "Username saved" : "Username cleared");
        }
      }, "→ Save Username"),

      React.createElement("Text", { style: { color: "white", fontSize: 16, marginBottom: 8 } }, "Badge Image URL"),
      React.createElement("TextInput", {
        style: { backgroundColor: "#2f3136", color: "white", padding: 10, borderRadius: 6, marginBottom: 10 },
        value: url,
        onChangeText: setUrl,
        placeholder: "https://i.imgur.com/...."
      }),
      React.createElement("Text", {
        style: { color: "#5865F2", marginBottom: 20 },
        onPress: () => {
          if (!url.trim()) {
            toasts.showToast("Enter a URL first");
            return;
          }
          settings.badges = settings.badges.concat([{ url: url.trim() }]);
          setUrl("");
          toasts.showToast("Badge added");
        }
      }, "→ Add Badge"),

      React.createElement("Text", {
        style: { color: "#ed4245", marginTop: 20 },
        onPress: () => {
          settings.customName = "";
          settings.badges = [];
          setName("");
          toasts.showToast("Cleared everything");
        }
      }, "→ Clear All")
    );
  }

  return {
    onLoad() {
      toasts.showToast("CustomVisualProfile loaded");
    },
    onUnload() {
      unpatches.forEach(u => { try { u(); } catch(e) {} });
    },
    settings: Settings
  };
};
