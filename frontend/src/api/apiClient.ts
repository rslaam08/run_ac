import axios from 'axios';

export const api = axios.create({
  baseURL: 'https://sshsrun-api.onrender.com/api',
  withCredentials: true
});
