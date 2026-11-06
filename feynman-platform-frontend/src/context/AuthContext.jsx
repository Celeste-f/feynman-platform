import {createContext,useContext,useState,useEffect} from 'react'

const AuthContext = createContext(null);

export function AuthProvider({children}){
  //读取本地存储的token和用户信息
  const [token,setToken] = useState(localStorage.getItem('token'));
  const [user,setUser] = useState(()=>{
    try { return JSON.parse(localStorage.getItem('user')) } catch { return null }
  });

  //token变化时持久化
  useEffect(()=>{
    if(token){
      localStorage.setItem('token',token)
    }else{
      localStorage.removeItem('token')
    }
  },[token])

  //user变化时持久化
  useEffect(()=>{
    if(user){
      localStorage.setItem('user', JSON.stringify(user))
    }else{
      localStorage.removeItem('user')
    }
  },[user])

  //登录：同时保存token和用户信息
  const login = (newToken, userInfo)=>{
    setToken(newToken)
    setUser(userInfo || null)
  }
  const logout = ()=>{
    setToken(null);
    setUser(null);
  }

  const value = {token, user, login, logout}
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

//自定义钩子
export function useAuth(){
  return useContext(AuthContext)
}
