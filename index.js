module.exports = (vendetta) => {
  const { patcher, metro, ui, storage, logger } = vendetta;
  const { findByProps, findByName } = metro;
  const { React, toasts } = ui;

  const settings = storage.createStorage("CustomVisualProfile");
  if (typeof settings.customName !== "string") settings.customName = "";
  if (!Array.isArray(settings.badges)) settings.badges = [];

  const unpatches = [];

  // Username override
  try {
    const UserStore = findByProps("getCurrentUser", "getUser");
    if (UserStore?.getUser) {
      unpatches.push(
        patcher.instead(UserStore, "getUser", (args, orig) => {
          const user = orig(...args);
          try {
            const me = UserStore.getCurrentUser?.();
            if (user && me && user.id === me.id && settings.customName?.trim()) {
              return new Proxy(user, {
                get(target, prop) {
                  if (prop === "username" || prop === "globalName" || prop === "displayName") {
                    return settings.customName;
                  }
                  return Reflect.get(target, prop);
                },
              });
            }
          } catch {}
          return user;
        })
      );
    }
  } catch (e) {
    logger.log("Username patch error:", e);
  }

  // Badge injection
  try {
    const ProfileBadges = findByName("ProfileBadges") || findByName("ProfileBadges", { default: false });
    if (ProfileBadges) {
      const hasDefault = "default" in ProfileBadges;
      unpatches.push(
        patcher.after(ProfileBadges, hasDefault ? "default" : undefined, (args, res) => {
          try {
            const user = args?.[0]?.user;
            const me = findByProps("getCurrentUser")?.getCurrentUser?.();
            if (!user || !me || user.id !== me.id || !settings.badges?.length) return res;

            const badgeElements = settings.badges
              .filter((b) => b?.url)
              .map((b, i) =>
                React.createElement("Image", {
                  key: `cvp-${i}`,
                  source: { uri: b.url },
                  style: { width: 18, height: 18, marginLeft: 4 },
                  resizeMode: "contain",
                })
              );

            if (!badgeElements.length) return res;

            if (res?.props) {
              if (Array.isArray(res.props.children)) {
                res.props.children = [...res.props.children, ...badgeElements];
              } else if (res.props.badges) {
                res.props.badges = [...(res.props.badges || []), ...badgeElements];
              }
            }
          } catch {}
          return res;
        })
      );
    }
  } catch (e) {
    logger.log("Badge patch error:", e);
  }

  // Simple settings that should work better
  function Settings() {
    const [name, setName] = React.useState(settings.customName || "");
    const [url, setUrl] = React.useState("");
    const [badges, setBadges] = React.useState([...(settings.badges || [])]);

    return React.createElement(
      "ScrollView",
      { style: { padding: 16 } },
      React.createElement("Text", { style: { color: "#fff", fontSize: 18, marginBottom: 8 } }, "Visual Username"),
      React.createElement("TextInput", {
        style: { backgroundColor: "#2f3136", color: "#fff", padding: 10, borderRadius: 8, marginBottom: 8 },
        value: name,
        onChangeText: setName,
        placeholder: "Enter custom name",
        placeholderTextColor: "#72767d"
      }),
      React.createElement("TouchableOpacity", {
        style: { backgroundColor: "#5865F2", padding: 12, borderRadius: 8, alignItems: "center", marginBottom: 20 },
        onPress: () => {
          settings.customName = name.trim();
          toasts.showToast(name.trim() ? `Username set to "${name.trim()}"` : "Username cleared");
        }
      }, React.createElement("Text", { style: { color: "#fff", fontWeight: "bold" } }, "Save Username")),

      React.createElement("Text", { style: { color: "#fff", fontSize: 18, marginBottom: 8 } }, "Add Badge"),
      React.createElement("TextInput", {
        style: { backgroundColor: "#2f3136", color: "#fff", padding: 10, borderRadius: 8, marginBottom: 8 },
        value: url,
        onChangeText: setUrl,
        placeholder: "https://i.imgur.com/....png",
        placeholderTextColor: "#72767d"
      }),
      React.createElement("TouchableOpacity", {
        style: { backgroundColor: "#5865F2", padding: 12, borderRadius: 8, alignItems: "center", marginBottom: 20 },
        onPress: () => {
          if (!url.trim()) {
            toasts.showToast("Enter a badge image URL");
            return;
          }
          const newBadges = [...badges, { url: url.trim(), name: "Custom Badge" }];
          settings.badges = newBadges;
          setBadges(newBadges);
          setUrl("");
          toasts.showToast("Badge added!");
        }
      }, React.createElement("Text", { style: { color: "#fff", fontWeight: "bold" } }, "Add Badge")),

      badges.length > 0 && React.createElement("Text", { style: { color: "#fff", fontSize: 16, marginBottom: 8 } }, "Your Badges (tap to remove):"),
      ...badges.map((b, i) =>
        React.createElement("TouchableOpacity", {
          key: i,
          style: { backgroundColor: "#2f3136", padding: 12, borderRadius: 8, marginBottom: 8 },
          onPress: () => {
            const newBadges = badges.filter((_, idx) => idx !== i);
            settings.badges = newBadges;
            setBadges(newBadges);
            toasts.showToast("Badge removed");
          }
        }, React.createElement("Text", { style: { color: "#fff" } }, b.url))
      ),

      React.createElement("TouchableOpacity", {
        style: { backgroundColor: "#ed4245", padding: 12, borderRadius: 8, alignItems: "center", marginTop: 20 },
        onPress: () => {
          settings.customName = "";
          settings.badges = [];
          setName("");
          setBadges([]);
          toasts.showToast("Everything cleared");
        }
      }, React.createElement("Text", { style: { color: "#fff", fontWeight: "bold" } }, "Clear All"))
    );
  }

  return {
    onLoad() {
      logger.log("CustomVisualProfile loaded");
      toasts.showToast("Custom Visual Profile loaded");
    },
    onUnload() {
      unpatches.forEach((u) => { try { u(); } catch {} });
    },
    settings: Settings,
  };
};
