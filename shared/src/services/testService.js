import { supabase } from '../lib/supabase.js';

export const testService = {
  async getTests(classId = null) {
    let query = supabase.from('tests').select('*').order('created_at', { ascending: false });
    if (classId) {
      query = query.eq('class_id', classId);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async getQuestions(subject = null) {
    let query = supabase.from('question_bank').select('*');
    if (subject) {
      query = query.eq('subject', subject);
    }
    const { data, error } = await query;
    if (error) throw error;
    return data || [];
  },

  async createTest(testData) {
    const { data, error } = await supabase.from('tests').insert([testData]).select().single();
    if (error) throw error;
    return data;
  },

  async submitQuizResult(resultData) {
    // Write to Supabase test_submissions table
    const { data, error } = await supabase.from('test_submissions').insert([{
      student_id: resultData.student_id || resultData.userId,
      test_id: resultData.test_id || resultData.quizId,
      score: resultData.score,
      grade: resultData.grade || (resultData.score >= 80 ? 'A' : resultData.score >= 60 ? 'B' : 'C'),
      answers_json: resultData.answers || {},
      submitted_at: new Date().toISOString()
    }]).select();

    // Cache locally as fallback
    try {
      const current = JSON.parse(localStorage.getItem('student_test_results') || '[]');
      current.push(resultData);
      localStorage.setItem('student_test_results', JSON.stringify(current));
    } catch(e) {}

    if (error) {
      console.warn('DB submission fallback to local storage:', error.message);
      return { success: true, localOnly: true };
    }
    return data;
  }
};
export default testService;
