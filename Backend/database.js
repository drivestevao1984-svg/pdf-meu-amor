const { createClient } = require('@supabase/supabase-js');
require('dotenv').config();

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_PUBLISHABLE_KEY;

const supabase = createClient(supabaseUrl, supabaseKey);

async function salvarConversao(dados) {
    try {
        const { data, error } = await supabase
            .from('conversions')
            .insert([dados])
            .select();
        
        if (error) {
            console.error('Erro ao salvar no banco:', error);
            return null;
        }
        
        console.log('✅ Conversão salva no banco:', data);
        return data;
    } catch (error) {
        console.error('Erro inesperado:', error);
        return null;
    }
}

module.exports = { supabase, salvarConversao };