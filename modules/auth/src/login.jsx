import { h, define, Component } from "wpa";
import { css } from "wpa-ui";
import { Security } from "~/modules/common/index.js";

import loginCSS from "./login.scss";

export default class extends Component {
  static css = [
    css.getCSSStyleSheets(
      "reboot",
      "forms",
      "utilities",
      "grid",
      "containers",
      "buttons"
    ),
    loginCSS,
  ];
  data = { password: "123456", userName: "user" };
  get bindingScope() {
    return this.data;
  }
  render() {
    return (
      <div className="container align-self-center  login-container">
        <div className="row justify-content-center">
          <form
            className="shadow-lg bg-body rounded col-10 col-md-5 col-lg-4"
            is="wp-form"
            onSubmit={(evt) => {
              Security.login();
              evt.preventDefault();
            }}
          >
            <div class="mb-3">
              <label for="userName" class="form-label">
                用户名
              </label>
              <input
                class="form-control"
                id="userName"
                placeholder="username"
                o-model="userName"
                required
              />
            </div>
            <div class="mb-3">
              <label for="password" class="form-label">
                密码
              </label>

              <input
                type="password"
                class="form-control"
                id="password"
                placeholder="******"
                o-model="password"
                required
              />
            </div>

            <div class="d-grid my-5">
              <button className="btn btn-outline-primary" type="submit">
                登录
              </button>
            </div>
          </form>
        </div>
      </div>
    );
  }
}
