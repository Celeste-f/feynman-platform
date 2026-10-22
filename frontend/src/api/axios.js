import axios from 'axios';

const apiClient = axios.create({
  baseURL: 'http://localhost:3000/api', //后端接口基础地址
  headers: {
    'Content-Type':'application/json'
  }
})

export default apiClient;
