import React, { createContext, useContext, useState, ReactNode } from 'react';

export interface Request {
  id: string;
  brand: string;
  deviceType: string;
  model: string;
  issue: string;
  description: string;
  location: string;
  status: 'pending' | 'accepted' | 'completed';
  timestamp: Date;
  price: string;
}

interface RequestContextType {
  requests: Request[];
  addRequest: (request: Omit<Request, 'id' | 'timestamp' | 'status'>) => void;
  updateRequestStatus: (id: string, status: Request['status']) => void;
}

const RequestContext = createContext<RequestContextType | undefined>(undefined);

export function RequestProvider({ children }: { children: ReactNode }) {
  const [requests, setRequests] = useState<Request[]>([]);

  const addRequest = (newRequest: Omit<Request, 'id' | 'timestamp' | 'status'>) => {
    const request: Request = {
      ...newRequest,
      id: Math.random().toString(36).substr(2, 9),
      timestamp: new Date(),
      status: 'pending',
    };
    setRequests(prev => [request, ...prev]);
  };

  const updateRequestStatus = (id: string, status: Request['status']) => {
    setRequests(prev => prev.map(req => 
      req.id === id ? { ...req, status } : req
    ));
  };

  return (
    <RequestContext.Provider value={{ requests, addRequest, updateRequestStatus }}>
      {children}
    </RequestContext.Provider>
  );
}

export function useRequests() {
  const context = useContext(RequestContext);
  if (context === undefined) {
    throw new Error('useRequests must be used within a RequestProvider');
  }
  return context;
}
