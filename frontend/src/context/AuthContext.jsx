import {createContext,useContext,useState,useEffect} from 'react'

const AuthContext = createContext(null);

export function AuthProvider({children}){
  //读取本地存储的token
  const [token,setToken] = useState(localStorage.getItem('token'));

  useEffect(()=>{
    if(token){
      localStorage.setItem('token',token)
    }else{
      localStorage.removeItem('token')
    }
  },[token])

  const login = (newToken)=>{
    setToken(newToken)
  }
  const logout = ()=>{
    setToken(null);
  }

  const value = {token,login,logout}
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

//自定义钩子
export function useAuth(){
  return useContext(AuthContext)
}
