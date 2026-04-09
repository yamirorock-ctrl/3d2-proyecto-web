import { getClient } from './supabaseService';

export interface MLConfig {
  classic_fee: number;
  fixed_fee_unit: number;
  fixed_fee_threshold: number;
  shipping_cost: number;
  installment_3: number;
  installment_6: number;
  installment_9: number;
  installment_12: number;
}

export interface FiscalConfig {
  monotributo_category: string;
  monthly_limit: number;
  is_active: boolean;
  start_date?: string;
}

const DEFAULT_CONFIG: MLConfig = {
  classic_fee: 0.1435,
  fixed_fee_unit: 2950,
  fixed_fee_threshold: 30000,
  shipping_cost: 10122,
  installment_3: 0.09,
  installment_6: 0.1488,
  installment_9: 0.2035,
  installment_12: 0.2333
};

const DEFAULT_FISCAL: FiscalConfig = {
    monotributo_category: 'A',
    monthly_limit: 537500,
    is_active: true,
    start_date: '2026-04-01'
};

export async function getMLConfig(): Promise<MLConfig> {
  const client = getClient();
  try {
    const { data, error } = await (client
      .from('app_settings') as any)
      .select('ml_simulator_config')
      .eq('id', 1)
      .single();

    if (error || !data || !data.ml_simulator_config) {
      return DEFAULT_CONFIG;
    }
    return { ...DEFAULT_CONFIG, ...data.ml_simulator_config };
  } catch (e) {
    return DEFAULT_CONFIG;
  }
}

export async function saveMLConfig(config: MLConfig): Promise<boolean> {
  const client = getClient();
  try {
    const { error } = await (client
      .from('app_settings') as any)
      .update({ 
        ml_simulator_config: config,
        updated_at: new Date().toISOString()
      })
      .eq('id', 1);

    if (error) throw error;
    return true;
  } catch (e) {
    return false;
  }
}

export async function getFiscalConfig(): Promise<FiscalConfig> {
    const client = getClient();
    try {
        const { data, error } = await (client.from('app_settings') as any)
          .select('fiscal_config')
          .eq('id', 1)
          .single();
          
        if (error || !data || !data.fiscal_config) return DEFAULT_FISCAL;
        return { ...DEFAULT_FISCAL, ...data.fiscal_config };
    } catch (e) {
        return DEFAULT_FISCAL;
    }
}

export async function saveFiscalConfig(config: FiscalConfig): Promise<boolean> {
    const client = getClient();
    try {
        const { error } = await (client.from('app_settings') as any)
          .update({ 
            fiscal_config: config, 
            updated_at: new Date().toISOString()
        })
        .eq('id', 1);
        
        if (error) throw error;
        return true;
    } catch (e) {
        return false;
    }
}
