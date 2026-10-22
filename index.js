/**
 * CustomVisualProfile - Bunny / Vendetta plugin
 * Change your visual username + add custom badges (client-side only)
 *
 * Install: Paste the raw URL of this file into Bunny → Plugins
 */

module.exports = (vendetta) => {
  const { patcher, metro, ui, storage, logger } = vendetta;
  const { findByProps, findByName } = metro;
  const { React, toasts } = ui;

  // Form components
  let FormSection, FormRow, FormInput, FormDivider;
  try {
    const Forms = findByProps("FormSection", "FormRow") || {};
    FormSection = Forms.FormSection;
    FormRow = Forms.FormRow;
    FormInput = Forms.FormInput;
    FormDivider = Forms.FormDivider;
  } catch (e) {
    logger.log("Failed to load Forms:", e);
  }

  // Persistent storage
  const settings = storage.createStorage("CustomVisualProfile");
  if (typeof settings.customName !== "string") settings.customName = "";
  if (!Array.isArray(settings.badges)) settings.badges = [];

  const unpatches = [];

  // ========== Username override ==========
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

  // ========== Badge injection ==========
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
                  key: `cvp-badge-${i}`,
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

  // ========== Settings UI (opens when you click the wrench) ==========
  function Settings() {
    const [name, setName] = React.useState(settings.customName || "");
    const [url, setUrl] = React.useState("");
    const [badgeLabel, setBadgeLabel] = React.useState("");
    const [badges, setBadges] = React.useState([...(settings.badges || [])]);

    const saveName = () => {
      settings.customName = name.trim();
      toasts.showToast(
        name.trim() ? `Username set to "${name.trim()}"` : "Username cleared"
      );
    };

    const addBadge = () => {
      if (!url.trim()) {
        toasts.showToast("Enter a badge image URL");
        return;
      }
      const newBadges = [
        ...badges,
        { url: url.trim(), name: badgeLabel.trim() || "Custom Badge" },
      ];
      settings.badges = newBadges;
      setBadges(newBadges);
      setUrl("");
      setBadgeLabel("");
      toasts.showToast("Badge added!");
    };

    const removeBadge = (index) => {
      const newBadges = badges.filter((_, i) => i !== index);
      settings.badges = newBadges;
      setBadges(newBadges);
      toasts.showToast("Badge removed");
    };

    const clearAll = () => {
      settings.customName = "";
      settings.badges = [];
      setName("");
      setBadges([]);
      toasts.showToast("Everything cleared");
    };

    if (!FormSection) {
      return React.createElement(
        "Text",
        { style: { padding: 16, color: "#fff" } },
        "Forms not available on this Discord version"
      );
    }

    return React.createElement(
      React.Fragment,
      null,

      // Username section
      React.createElement(
        FormSection,
        { title: "Visual Username" },
        React.createElement(FormInput, {
          title: "Custom Display Name",
          value: name,
          onChange: setName,
          placeholder: "Leave empty for real name",
        }),
        React.createElement(FormRow, {
          label: "Save Username",
          onPress: saveName,
        })
      ),

      // Badges section
      React.createElement(
        FormSection,
        { title: "Custom Badges" },
        React.createElement(FormInput, {
          title: "Badge Image URL",
          value: url,
          onChange: setUrl,
          placeholder: "https://i.imgur.com/example.png",
        }),
        React.createElement(FormInput, {
          title: "Badge Name (optional)",
          value: badgeLabel,
          onChange: setBadgeLabel,
          placeholder: "My Custom Badge",
        }),
        React.createElement(FormRow, {
          label: "Add Badge",
          onPress: addBadge,
        }),
        badges.length > 0 && React.createElement(FormDivider, null),
        ...badges.map((b, i) =>
          React.createElement(FormRow, {
            key: i,
            label: b.name || `Badge ${i + 1}`,
            subLabel: b.url,
            onPress: () => removeBadge(i),
          })
        )
      ),

      // Danger zone
      React.createElement(
        FormSection,
        { title: "Danger Zone" },
        React.createElement(FormRow, {
          label: "Clear All",
          onPress: clearAll,
        })
      ),

      // Note
      React.createElement(
        FormSection,
        { title: "Info" },
        React.createElement(FormRow, {
          label: "Client-side only",
          subLabel:
            "Only you can see the custom name and badges. Everyone else still sees your real profile.",
        })
      )
    );
  }

  // Plugin lifecycle
  return {
    onLoad() {
      logger.log("CustomVisualProfile loaded");
      toasts.showToast("Custom Visual Profile loaded ✨");
    },
    onUnload() {
      unpatches.forEach((u) => {
        try {
          u();
        } catch {}
      });
    },
    // This is what makes the wrench appear and open the settings
    settings: Settings,
  };
};
