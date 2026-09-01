const fs = require('fs');
const content = fs.readFileSync('src/supabase.js', 'utf8');
const url = content.match(/supabaseUrl = '(.*?)'/)[1];
const key = content.match(/supabaseKey = '(.*?)'/)[1];
const { createClient } = require('@supabase/supabase-js');
const supabase = createClient(url, key);

async function run() {
  const currentUser = { email: 'gauravroy476@gmail.com' };
  
  const { data: d1 } = await supabase.from('conversations').select('*').eq('type', 'group').contains('participants', [currentUser.email]);
  console.log('Array:', d1 ? d1.length : 0);
  
  const { data: d2 } = await supabase.from('conversations').select('*').eq('type', 'group').contains('participants', `["${currentUser.email}"]`);
  console.log('Stringified Array:', d2 ? d2.length : 0);
  
  const { data: d3 } = await supabase.from('conversations').select('*').eq('type', 'group').filter('participants', 'cs', `["${currentUser.email}"]`);
  console.log('Filter cs Stringified Array:', d3 ? d3.length : 0);

  const { data: d4 } = await supabase.from('conversations').select('*').eq('type', 'group').or(`participants.cs.["${currentUser.email}"]`);
  console.log('OR cs query:', d4 ? d4.length : 0);

  if (d4 && d4.length > 0) {
    console.log('OR query worked! Groups found:', d4.map(g => g.name).join(', '));
  }
}
run();
