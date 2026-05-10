import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TestTokenState {
  isTestMode: boolean;
  testToken: string | null;
  testBalance: number;
  testLinkId: string | null;
}

interface TestLinkCreditRow {
  id: string;
  credits_total: number;
  credits_used: number;
}

/**
 * Hook para gerenciar links de teste com créditos limitados.
 * Quando ?test_token=XXX está na URL, o provador funciona sem WordPress
 * mas com créditos limitados armazenados no Supabase.
 */
export function useTestToken() {
  const [state, setState] = useState<TestTokenState>({
    isTestMode: false,
    testToken: null,
    testBalance: 0,
    testLinkId: null,
  });
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const init = async () => {
      const params = new URLSearchParams(window.location.search);
      const token = params.get("test_token");

      if (!token) {
        setIsLoading(false);
        return;
      }

      console.log("[TestToken] Token encontrado, validando...");

      const { data, error } = await supabase
        .from("test_links")
        .select("*")
        .eq("token", token)
        .eq("is_active", true)
        .maybeSingle();

      if (error || !data) {
        console.error("[TestToken] Token inválido ou inativo");
        setIsLoading(false);
        return;
      }

      const link = data as TestLinkCreditRow;
      const remaining = link.credits_total - link.credits_used;

      console.log("[TestToken] Token válido! Créditos restantes:", remaining);

      setState({
        isTestMode: true,
        testToken: token,
        testBalance: remaining,
        testLinkId: link.id,
      });
      setIsLoading(false);
    };

    init();
  }, []);

  const debitTestCredit = useCallback(async (): Promise<boolean> => {
    if (!state.testLinkId) return false;

    // Re-fetch to get latest credits_used
    const { data, error } = await supabase
      .from("test_links")
      .select("credits_total, credits_used")
      .eq("id", state.testLinkId)
      .single();

    if (error || !data) return false;

    const link = data as TestLinkCreditRow;
    if (link.credits_used >= link.credits_total) {
      setState(prev => ({ ...prev, testBalance: 0 }));
      return false;
    }

    const { error: updateError } = await supabase
      .from("test_links")
      .update({ credits_used: link.credits_used + 1 } as never)
      .eq("id", state.testLinkId);

    if (updateError) return false;

    const newBalance = link.credits_total - link.credits_used - 1;
    setState(prev => ({ ...prev, testBalance: newBalance }));
    return true;
  }, [state.testLinkId]);

  const refreshTestBalance = useCallback(async () => {
    if (!state.testLinkId) return;

    const { data } = await supabase
      .from("test_links")
      .select("credits_total, credits_used")
      .eq("id", state.testLinkId)
      .single();

    if (data) {
      const link = data as TestLinkCreditRow;
      setState(prev => ({ ...prev, testBalance: link.credits_total - link.credits_used }));
    }
  }, [state.testLinkId]);

  return {
    ...state,
    isLoading,
    debitTestCredit,
    refreshTestBalance,
  };
}
