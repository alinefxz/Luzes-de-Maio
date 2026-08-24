(() => {
  const PROJECT_URL = 'https://kheohktxfgsouipmmord.supabase.co';
  const PUBLISHABLE_KEY = 'sb_publishable_WpoQMF5rHkGMqAGMlz6K7g_mV2Dh02v';
  const TOKEN_KEY = 'lm_remote_session';

  const functionNames = {
    register: 'lm_register',
    login: 'lm_login',
    me: 'lm_me',
    saveUser: 'lm_save_user',
    saveReview: 'lm_save_review',
    logout: 'lm_logout',
    deleteUser: 'lm_delete_user'
  };

  const getToken = () => localStorage.getItem(TOKEN_KEY) || '';
  const setToken = (token) => token ? localStorage.setItem(TOKEN_KEY, token) : localStorage.removeItem(TOKEN_KEY);

  async function rpc(functionName, payload = {}) {
    const response = await fetch(`${PROJECT_URL}/rest/v1/rpc/${functionName}`, {
      method: 'POST',
      headers: {
        apikey: PUBLISHABLE_KEY,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) {
      const message = String(data.message || data.details || data.hint || 'remote-error');
      const error = new Error(message);
      error.status = response.status;
      error.code = data.code;
      throw error;
    }
    return data;
  }

  async function register(user) {
    const result = await rpc(functionNames.register, { p_user: user });
    setToken(result.token);
    return result.user;
  }

  async function login(name, password) {
    const result = await rpc(functionNames.login, { p_name: name, p_password: password });
    setToken(result.token);
    return result.user;
  }

  async function me() {
    const token = getToken();
    if (!token) return null;
    const result = await rpc(functionNames.me, { p_token: token });
    return result.user;
  }

  async function saveUser(user) {
    const token = getToken();
    if (!token) throw new Error('missing-session');
    const result = await rpc(functionNames.saveUser, { p_token: token, p_user: user });
    return result.user;
  }

  async function saveReview(review) {
    const token = getToken();
    if (!token) throw new Error('missing-session');
    return rpc(functionNames.saveReview, { p_token: token, p_review: review });
  }

  async function logout() {
    const token = getToken();
    try {
      if (token) await rpc(functionNames.logout, { p_token: token });
    } finally {
      setToken('');
    }
  }

  async function deleteUser() {
    const token = getToken();
    if (!token) throw new Error('missing-session');
    const result = await rpc(functionNames.deleteUser, { p_token: token });
    setToken('');
    return result;
  }

  window.LMSupabaseApi = {
    register,
    login,
    me,
    saveUser,
    saveReview,
    logout,
    deleteUser,
    getToken,
    clearToken: () => setToken('')
  };
})();

