// clientApiService.ts (updated to align with models, added missing interfaces/methods like ResumeBotResponse, getUnactiveBots, resumeBot)
import Cookies from 'js-cookie';

export interface ApiResponse<T> {
  data?: T;
  error?: {
    message: string;
    statusCode?: number;
  };
}

export interface StartBotRequest {
  token0_address: string;
  token1_address: string;
  token0_amount: number;
  token1_amount: number;
  POOL_FEE: number;
}

export interface StartBotResponse {
  bot_id: string;
  position_id: number | null;
  message: string;
}

export interface StopBotResponse {
  status: string;
}

export interface WithdrawBotResponse {
  status: string;
  gas_eth: string;
  net_pnl_token0: string;
}

export interface ActiveBot {
  bot_id: string;
  position_id: number;
  token0_address: string;
  token1_address: string;
  token0_amount: string;
  token1_amount: string;
  POOL_FEE: number;
  status: string; // New
}

export interface ActiveBotsResponse {
  active_bots: ActiveBot[];
}

export interface UnactiveBotsResponse {
  unactive_bots: ActiveBot[];
}

export interface ResumeBotResponse {
  bot_id: string;
  position_id: number | null;
  message: string;
  status?: string; // Optional as per models
}

const clientApiService = {
  getToken: (): string | undefined => {
    if (typeof window === 'undefined') return undefined;
    return Cookies.get('accessToken');
  },

  setToken: (token: string, rememberMe: boolean = false): void => {
    if (typeof window !== 'undefined') {
      Cookies.set('accessToken', token, {
        path: '/',
        secure: true,
        sameSite: 'strict',
        expires: rememberMe ? 7 : 1,
      });
    }
  },

  clearToken: (): void => {
    if (typeof window !== 'undefined') {
      Cookies.remove('accessToken', { path: '/' });
    }
  },

  get: async <T>(url: string, requiresAuth: boolean = false, cache: RequestCache = 'default'): Promise<ApiResponse<T>> => {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (requiresAuth) {
        const token = clientApiService.getToken();
        if (!token) {
          throw new Error('No token found for authenticated request');
        }
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}${url}`, {
        method: 'GET',
        headers,
        cache,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! Status: ${response.status}`);
      }

      return { data };
    } catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  },

  post: async <T>(url: string, body: any, requiresAuth: boolean = false, cache: RequestCache = 'default'): Promise<ApiResponse<T>> => {
    try {
      const headers: HeadersInit = {
        'Content-Type': 'application/json',
      };

      if (requiresAuth) {
        const token = clientApiService.getToken();
        if (!token) {
          throw new Error('No token found for authenticated request');
        }
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(`${process.env.NEXT_PUBLIC_API_BASE_URL}${url}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body),
        cache,
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || `HTTP error! Status: ${response.status}`);
      }

      return { data };
    } catch (error) {
      return {
        error: {
          message: error instanceof Error ? error.message : 'Unknown error',
        },
      };
    }
  },

  // ... (patch and delete methods remain unchanged)

  startBot: async (payload: StartBotRequest, requiresAuth: boolean = false): Promise<StartBotResponse> => {
    const response = await clientApiService.post<StartBotResponse>(
      '/bot/start',
      payload,
      requiresAuth,
      'no-store'
    );
    if (response.error) {
      throw new Error(response.error.message);
    }
    return response.data!;
  },

  stopBot: async (botId: string, requiresAuth: boolean = false): Promise<StopBotResponse> => {
    const response = await clientApiService.post<StopBotResponse>(
      `/bot/${botId}/stop`,
      {},
      requiresAuth,
      'no-store'
    );
    if (response.error) {
      throw new Error(response.error.message);
    }
    return response.data!;
  },

  withdrawLiquidity: async (botId: string, requiresAuth: boolean = false): Promise<WithdrawBotResponse> => {
    const response = await clientApiService.post<WithdrawBotResponse>(
      `/bot/${botId}/withdraw`,
      {},
      requiresAuth,
      'no-store'
    );
    if (response.error) {
      throw new Error(response.error.message);
    }
    return response.data!;
  },

  resumeBot: async (botId: string, requiresAuth: boolean = false): Promise<ResumeBotResponse> => {
    const response = await clientApiService.post<ResumeBotResponse>(
      `/bot/${botId}/resume`,
      {},
      requiresAuth,
      'no-store'
    );
    if (response.error) {
      throw new Error(response.error.message);
    }
    return response.data!;
  },

  getActiveBots: async (requiresAuth: boolean = false): Promise<ActiveBotsResponse> => {
    const response = await clientApiService.get<ActiveBotsResponse>(
      '/bot/active',
      requiresAuth,
      'no-store'
    );
    if (response.error) {
      throw new Error(response.error.message);
    }
    return response.data!;
  },

  getUnactiveBots: async (requiresAuth: boolean = false): Promise<UnactiveBotsResponse> => {
    const response = await clientApiService.get<UnactiveBotsResponse>(
      '/bot/unactive',
      requiresAuth,
      'no-store'
    );
    if (response.error) {
      throw new Error(response.error.message);
    }
    return response.data!;
  },
};

export default clientApiService;