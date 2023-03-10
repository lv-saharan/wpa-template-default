let isLogined = false;
const LoginedCallbacks = [];
const LogoutedCallbacks = [];
export const Security = {
  async login(username, password) {
    isLogined = true;
    for (let cb of LoginedCallbacks) {
      cb();
    }
    return true;
  },
  async logout() {
    for (let cb of LogoutedCallbacks) {
      cb();
    }
  },

  get isLogined() {
    return isLogined;
  },
  onLogin(...callbacks) {
    LoginedCallbacks.push(...callbacks);
    return this;
  },
  onLogout(...callbacks) {
    LogoutedCallbacks.push(...callbacks);
    return this;
  },
};
