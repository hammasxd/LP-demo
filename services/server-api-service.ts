import { cookies } from 'next/headers';

export interface ApiResponse<T> {
  data?: T;
  error?: {
    message: string;
    statusCode?: number;
  };
}

export interface PaginatedResponse<T> {
  data: T[];
  total: number;
  limit: number;
  offset: number;
}
const serverApiService = {

  setToken: async (token: string): Promise<void> => {
    const cookieStore = await cookies();
    cookieStore.set('accessToken', token, {
      httpOnly: false,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'strict',
      path: '/',
      maxAge: 60 * 60 * 24 * 7, // 7 days
    });
  },

  getToken: async (): Promise<string | undefined> => {
    const cookieStore = await cookies();
    return cookieStore.get('accessToken')?.value;
  },

  clearToken: async (): Promise<void> => {
    const cookieStore = await cookies();
    cookieStore.delete('accessToken');
  },


  get: async <T>(url: string, requiresAuth: boolean = false, cache?: RequestCache): Promise<ApiResponse<T>> => {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (requiresAuth) {
        const token = await serverApiService.getToken();
        if (!token) {
          throw new Error('No token found for authenticated request');
        }
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}${url}`, {
        method: 'GET',
        headers,
        cache: cache || 'default',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          statusCode: undefined,
        },
      };
    }
  },

  post: async <T>(url: string, body: any, requiresAuth: boolean = false, cache?: RequestCache): Promise<ApiResponse<T>> => {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (requiresAuth) {
        const token = await serverApiService.getToken();
        if (!token) {
          throw new Error('No token found for authenticated request');
        }
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}${url}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        cache: cache || 'default',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          statusCode: undefined,
        },
      };
    }
  },

  patch: async <T>(url: string, body: any, requiresAuth: boolean = false, cache?: RequestCache): Promise<ApiResponse<T>> => {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (requiresAuth) {
        const token = await serverApiService.getToken();
        if (!token) {
          throw new Error('No token found for authenticated request');
        }
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}${url}`, {
        method: 'PATCH',
        headers,
        body: JSON.stringify(body),
        cache: cache || 'default',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          statusCode: undefined,
        },
      };
    }
  },

  delete: async <T>(url: string, requiresAuth: boolean = false, cache?: RequestCache): Promise<ApiResponse<T>> => {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (requiresAuth) {
        const token = await serverApiService.getToken();
        if (!token) {
          throw new Error('No token found for authenticated request');
        }
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}${url}`, {
        method: 'DELETE',
        headers,
        cache: cache || 'default',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          statusCode: undefined,
        },
      };
    }
  },

  getPaginated: async <T>(
    url: string,
    requiresAuth: boolean = false,
    offset: number = 0,
    limit: number = 10,
    cache?: RequestCache,
  ): Promise<ApiResponse<PaginatedResponse<T>>> => {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (requiresAuth) {
        const token = await serverApiService.getToken();
        if (!token) {
          throw new Error('No token found for authenticated request');
        }
        headers['Authorization'] = `Bearer ${token}`;
      }

      const queryParams = new URLSearchParams({
        offset: offset.toString(),
        limit: limit.toString(),
      });
      const fullUrl = `${url}?${queryParams.toString()}`;

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}${fullUrl}`, {
        method: 'GET',
        headers,
        cache: cache || 'default',
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || `HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      return data;
    } catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
          statusCode: undefined,
        },
      };
    }
  },

};

export default serverApiService;