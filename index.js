module.exports = (vendetta) => {
  const { patcher, metro, ui, storage, logger } = vendetta;
  const { findByProps, findByName } = metro;
  const { React, toasts } = ui;

  const settings = storage.createStorage("CustomVisualProfile");
  if (typeof settings.customName !== "string") settings.customName = "";
  if (!Array.isArray(settings.badges)) settings.badges = [];

  const unpatches = [];

  try {
    const UserStore = findByProps("getCurrentUser", "getUser");
    if (UserStore && UserStore.getUser) {
      unpatches.push(
        patcher.instead(UserStore, "getUser", (args, orig) => {
          const user = orig(...args);
          try {
            const me = UserStore.getCurrentUser && UserStore.getCurrentUser();
            if (user && me && user.id === me.id && settings.customName) {
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
  } catch (e) {}

  return {
    onLoad() {
      toasts.showToast("CustomVisualProfile is ON");
      logger.log("Plugin loaded successfully");
    },
    onUnload() {
      unpatches.forEach(u => { try { u(); } catch (e) {} });
    }
  };
};
