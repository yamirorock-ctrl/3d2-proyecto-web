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

export async function getMLConfig(): Promise<MLConfig> {
  const client = getClient();
  try {
    const { data, error } = await (client
      .from('app_settings') as any)
      .select('value')
      .eq('key', 'ml_simulator_config')
      .single();

    if (error || !data) {
      console.warn('[configService] Usando valores por defecto:', error?.message);
      return DEFAULT_CONFIG;
    }
    return { ...DEFAULT_CONFIG, ...data.value };
  } catch (e) {
    return DEFAULT_CONFIG;
  }
}

export async function saveMLConfig(config: MLConfig): Promise<boolean> {
  const client = getClient();
  try {
    const { error } = await (client
      .from('app_settings') as any)
      .upsert({ 
        key: 'ml_simulator_config', 
        value: config,
        updated_at: new Date().toISOString()
      }, { onConflict: 'key' });

    if (error) throw error;
    return true;
  } catch (e) {
    console.error('[configService] Error guardando config:', e);
    return false;
  }
}
