module.exports = (vendetta) => {
  const { ui } = vendetta;
  const { toasts } = ui;

  return {
    onLoad() {
      toasts.showToast("It works!");
    },
    onUnload() {}
  };
};
