import axios from "axios"

export const redisBaseUrl = 'https://middlewareapi.loop.markets/v1/juno/'

// Set config defaults when creating the instance
const axiosClient = axios.create({
    baseURL: redisBaseUrl,
    timeout: 5000,
    headers: {
        'content-Type': 'application/json',
        "Accept": "/",
        "Cache-Control": "no-cache"
        // "Cookie": document.cookie
    }
})

// const axiosClient = axios

export default axiosClient