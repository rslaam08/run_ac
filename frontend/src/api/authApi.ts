import axios from 'axios';

export const authApi = axios.create({
  baseURL: 'https://sshsrun-api.onrender.com/auth',
  withCredentials: true
});
