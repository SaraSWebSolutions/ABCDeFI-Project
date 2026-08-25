import React, { useState } from 'react';
import {
  GraduationCap,
  BookOpen,
  Award,
  CheckCircle2,
  Clock,
  Play,
  Sparkles,
  HelpCircle,
  FileCheck,
  Search,
  ExternalLink,
  ShieldCheck,
  ChevronRight,
  UserCheck,
  Compass,
  DollarSign,
  TrendingUp,
  PieChart,
  Users,
} from 'lucide-react';
import {
  COURSES,
  VIDEO_LESSONS,
  QUIZ_QUESTIONS,
  CERTIFICATES,
  TEACHERS,
  LEARNING_PATHS,
  FINANCIAL_LITERACY_PROGRAM,
  Course,
  Lesson,
  Certificate,
  claimCertificate,
} from '../Services/education';

export const FinancialEducation: React.FC = () => {
  const [activeEduTab, setActiveEduTab] = useState<
    'courses' | 'paths' | 'teachers' | 'exam' | 'literacy' | 'certificates'
  >('courses');

  const [coursesList, setCoursesList] = useState<Course[]>(COURSES);
  const [selectedCourse, setSelectedCourse] = useState<Course | null>(null);
  const [activeVideo, setActiveVideo] = useState<Lesson | null>(null);
  const [certificates, setCertificates] = useState<Certificate[]>(CERTIFICATES);
  const [userAnswers, setUserAnswers] = useState<{ [key: string]: number }>({});
  const [quizSubmitted, setQuizSubmitted] = useState(false);
  const [quizScore, setQuizScore] = useState(0);
  const [claiming, setClaiming] = useState(false);

  // Filter state
  const [categoryFilter, setCategoryFilter] = useState<string>('All');
  const [levelFilter, setLevelFilter] = useState<string>('All');

  const filteredCourses = coursesList.filter((c) => {
    if (categoryFilter !== 'All' && c.category !== categoryFilter) return false;
    if (levelFilter !== 'All' && c.level !== levelFilter) return false;
    return true;
  });

  const handleAnswerSelect = (questionId: string, optionIndex: number) => {
    if (quizSubmitted) return;
    setUserAnswers((prev) => ({ ...prev, [questionId]: optionIndex }));
  };

  const handleQuizSubmit = () => {
    let score = 0;
    QUIZ_QUESTIONS.forEach((q) => {
      if (userAnswers[q.id] === q.correctIndex) {
        score += 1;
      }
    });
    setQuizScore(score);
    setQuizSubmitted(true);
  };

  const handleClaimCert = async (courseId: string) => {
    setClaiming(true);
    try {
      const cert = await claimCertificate(courseId, '0x70997970C51812dc3A010C7d01b50e0d17dc79C8');
      setCertificates((prev) => [cert, ...prev]);
    } finally {
      setClaiming(false);
    }
  };

  return (
    <div id="financial-education-university" className="bg-slate-900 border border-slate-800 rounded-3xl p-6 shadow-2xl space-y-6 font-mono">
      
      {/* HEADER: UNIVERSITY TITLE & CREDIT HOURS PROGRESS */}
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-slate-800 pb-5">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-emerald-400 flex items-center gap-1.5">
            <span>ABCDeFi Academy</span>
            <span className="text-slate-600">↓</span>
            <span>Financial Education University</span>
          </div>
          <h2 className="text-xl font-black text-white tracking-tight flex items-center gap-2 mt-1">
            <GraduationCap className="w-6 h-6 text-emerald-400" />
            ABCDeFi Financial Education University
          </h2>
          <p className="text-xs text-slate-400 mt-0.5">
            Courses, Teachers, Learning Paths, Proctored Exams, Certificate NFTs, and Financial Literacy Program.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl text-xs">
            <div className="text-[10px] text-slate-500 uppercase font-bold">University Credits</div>
            <div className="text-sm font-extrabold text-emerald-400 mt-0.5">36 Credit Hours (GPA 3.9)</div>
          </div>
          <div className="bg-slate-950 border border-slate-800 p-3 rounded-2xl text-xs">
            <div className="text-[10px] text-slate-500 uppercase font-bold">NFT Certificates</div>
            <div className="text-sm font-extrabold text-amber-300 mt-0.5">{certificates.length} Issued</div>
          </div>
        </div>
      </div>

      {/* UNIVERSITY NAVIGATION TABS */}
      <div className="flex items-center gap-2 overflow-x-auto border-b border-slate-800 pb-3 no-scrollbar">
        {[
          { id: 'courses', label: '1. Courses & Video Library', icon: BookOpen },
          { id: 'paths', label: '2. Learning Paths', icon: Compass },
          { id: 'teachers', label: '3. Teachers & Faculty', icon: Users },
          { id: 'exam', label: '4. Proctored Exams', icon: HelpCircle },
          { id: 'literacy', label: '5. Financial Literacy', icon: DollarSign },
          { id: 'certificates', label: '6. Certificate NFTs', icon: Award },
        ].map((tab) => {
          const IconComp = tab.icon;
          const isSelected = activeEduTab === tab.id;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveEduTab(tab.id as any)}
              className={`px-4 py-2 rounded-2xl text-xs font-bold transition flex items-center gap-2 cursor-pointer whitespace-nowrap ${
                isSelected
                  ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-500/25 border border-emerald-500/40'
                  : 'bg-slate-950 text-slate-400 hover:text-slate-200 border border-slate-800'
              }`}
            >
              <IconComp className="w-3.5 h-3.5" />
              <span>{tab.label}</span>
            </button>
          );
        })}
      </div>

      {/* ========================================================================= */}
      {/* 1. COURSES & VIDEO LIBRARY                                                */}
      {/* ========================================================================= */}
      {activeEduTab === 'courses' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between flex-wrap gap-3">
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold">Filter Category:</span>
              {['All', 'DeFi', 'CeFi', 'NFT', 'Blockchain'].map((cat) => (
                <button
                  key={cat}
                  onClick={() => setCategoryFilter(cat)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                    categoryFilter === cat ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40' : 'bg-slate-950 text-slate-400'
                  }`}
                >
                  {cat}
                </button>
              ))}
            </div>

            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-400 font-bold">Level:</span>
              {['All', 'Beginner', 'Intermediate', 'Advanced'].map((lvl) => (
                <button
                  key={lvl}
                  onClick={() => setLevelFilter(lvl)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold transition ${
                    levelFilter === lvl ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-500/40' : 'bg-slate-950 text-slate-400'
                  }`}
                >
                  {lvl}
                </button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {filteredCourses.map((c) => (
              <div key={c.id} className="bg-slate-950 border border-slate-800 p-5 rounded-3xl space-y-3 flex flex-col justify-between">
                <div className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-2xl">{c.icon}</span>
                    <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-emerald-500/10 text-emerald-300 border border-emerald-500/30">
                      {c.level}
                    </span>
                  </div>
                  <h3 className="font-bold text-white text-sm">{c.title}</h3>
                  <p className="text-xs text-slate-400 line-clamp-2">{c.description}</p>
                </div>

                <div className="space-y-3 pt-2 border-t border-slate-800 text-xs">
                  <div className="flex justify-between text-slate-500 text-[10px]">
                    <span>{c.duration} • {c.lessons} Lessons</span>
                    <span>Progress: {c.progress}%</span>
                  </div>

                  <div className="w-full bg-slate-900 rounded-full h-1.5 overflow-hidden">
                    <div className="bg-emerald-500 h-full rounded-full" style={{ width: `${c.progress}%` }}></div>
                  </div>

                  <button
                    onClick={() => setSelectedCourse(c)}
                    className="w-full bg-slate-900 hover:bg-slate-800 text-white font-bold py-2 rounded-xl text-xs transition cursor-pointer flex items-center justify-center gap-1.5"
                  >
                    <Play className="w-3.5 h-3.5 text-emerald-400" /> View Video Lessons
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* VIDEO LESSON MODAL / PLAYER */}
          {selectedCourse && (
            <div className="bg-slate-950 border border-emerald-500/40 p-6 rounded-3xl space-y-4 font-mono">
              <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                <div className="flex items-center gap-2">
                  <span className="text-xl">{selectedCourse.icon}</span>
                  <h3 className="text-sm font-bold text-white">{selectedCourse.title} — Video Lessons</h3>
                </div>
                <button onClick={() => { setSelectedCourse(null); setActiveVideo(null); }} className="text-slate-400 hover:text-white cursor-pointer font-bold">✕ Close</button>
              </div>

              {/* EMBEDDED INTERACTIVE VIDEO PLAYER SCREEN */}
              {activeVideo && (
                <div className="p-5 bg-slate-900 border border-emerald-500/50 rounded-2xl space-y-4 shadow-2xl animate-in fade-in duration-300">
                  <div className="flex items-center justify-between border-b border-slate-800 pb-2.5">
                    <div className="flex items-center gap-2 text-emerald-400 font-bold text-sm">
                      <Play className="w-4 h-4 fill-current" />
                      <span>Now Playing: {activeVideo.title}</span>
                    </div>
                    <span className="px-2.5 py-0.5 rounded bg-emerald-500/20 text-emerald-300 text-[10px] font-bold">
                      {activeVideo.duration} • 1080p HD
                    </span>
                  </div>

                  {/* Simulated Video Canvas Player */}
                  <div className="relative w-full h-64 sm:h-80 bg-slate-950 border border-slate-800 rounded-2xl overflow-hidden flex flex-col items-center justify-center space-y-3 group shadow-inner">
                    <iframe
                      src={activeVideo.videoUrl}
                      title={activeVideo.title}
                      className="w-full h-full border-0"
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                      allowFullScreen
                    ></iframe>
                  </div>

                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pt-2">
                    <div>
                      <div className="text-xs font-bold text-white">{activeVideo.title}</div>
                      <div className="text-[11px] text-slate-400">{activeVideo.description}</div>
                    </div>
                    <button
                      onClick={() => {
                        // Mark course completed & issue cert
                        setCoursesList((prev) =>
                          prev.map((c) => (c.id === selectedCourse.id ? { ...c, progress: 100 } : c))
                        );
                        handleClaimCert(selectedCourse.id);
                        alert(`🎉 Lesson "${activeVideo.title}" Completed! +50 XP Earned & Certificate NFT Minted on Sepolia EVM!`);
                      }}
                      className="px-5 py-2.5 bg-gradient-to-r from-emerald-500 to-teal-500 hover:from-emerald-400 hover:to-teal-400 text-slate-950 font-black text-xs rounded-xl transition cursor-pointer shadow-lg shadow-emerald-500/20 whitespace-nowrap flex items-center gap-2"
                    >
                      <CheckCircle2 className="w-4 h-4 text-slate-950" />
                      <span>Complete Lesson (+50 XP) 🎓</span>
                    </button>
                  </div>
                </div>
              )}

              {/* VIDEO LESSONS LIST GRID */}
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-xs">
                {VIDEO_LESSONS.filter((v) => v.courseId === selectedCourse.id).map((v) => (
                  <div key={v.id} className="p-4 bg-slate-900 border border-slate-800 hover:border-emerald-500/40 rounded-2xl space-y-2 transition flex flex-col justify-between">
                    <div className="space-y-2">
                      <div className="flex items-center justify-between">
                        <div className="font-bold text-white flex items-center gap-2">
                          <Play className="w-3.5 h-3.5 text-emerald-400" />
                          <span>{v.title}</span>
                        </div>
                        <span className="text-[10px] text-slate-500 font-mono">{v.duration}</span>
                      </div>
                      <p className="text-[11px] text-slate-400 leading-relaxed">{v.description}</p>
                    </div>

                    <div className="pt-2 border-t border-slate-800 flex items-center justify-between">
                      <button
                        onClick={() => setActiveVideo(v)}
                        className="px-4 py-2 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-xs rounded-xl transition cursor-pointer shadow-md shadow-emerald-600/20 flex items-center gap-1.5"
                      >
                        <Play className="w-3.5 h-3.5 fill-current" /> Watch Video Lesson
                      </button>
                      <a
                        href={v.videoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-[10px] text-slate-400 hover:text-emerald-400 transition flex items-center gap-1"
                      >
                        <span>YouTube</span>
                        <ExternalLink className="w-3 h-3" />
                      </a>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 2. LEARNING PATHS TRACKS                                                  */}
      {/* ========================================================================= */}
      {activeEduTab === 'paths' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {LEARNING_PATHS.map((path) => (
            <div key={path.id} className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-4 flex flex-col justify-between">
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-3xl">{path.icon}</span>
                  <span className="px-3 py-1 rounded-full text-xs font-bold bg-indigo-500/20 text-indigo-300 border border-indigo-500/30">
                    {path.creditHours} Credit Hours
                  </span>
                </div>
                <h3 className="font-extrabold text-white text-base">{path.title}</h3>
                <p className="text-xs text-slate-400">{path.description}</p>
              </div>

              <div className="space-y-3 pt-3 border-t border-slate-800 text-xs">
                <div className="flex justify-between text-slate-400 text-[11px]">
                  <span>Duration: {path.duration}</span>
                  <span>Courses: {path.totalCourses} Modules</span>
                </div>

                <button className="w-full bg-indigo-600 hover:bg-indigo-500 text-white font-bold py-2.5 rounded-2xl text-xs transition cursor-pointer flex items-center justify-center gap-2">
                  <Compass className="w-4 h-4" /> Start Learning Path Track
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 3. TEACHERS & FACULTY DIRECTORY                                           */}
      {/* ========================================================================= */}
      {activeEduTab === 'teachers' && (
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {TEACHERS.map((teacher) => (
            <div key={teacher.id} className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-4">
              <div className="flex items-center gap-3">
                <span className="text-4xl p-2 bg-slate-900 rounded-2xl border border-slate-800">{teacher.avatarUrl}</span>
                <div>
                  <h3 className="font-extrabold text-white text-sm">{teacher.name}</h3>
                  <div className="text-xs text-emerald-400 font-bold">{teacher.title}</div>
                  <div className="text-[10px] text-amber-300">Rating: ★ {teacher.rating} / 5.0</div>
                </div>
              </div>

              <p className="text-xs text-slate-400">{teacher.bio}</p>

              <div className="pt-3 border-t border-slate-800 text-xs text-slate-400">
                <span className="font-bold text-white">Courses Taught: </span>
                {teacher.coursesTaught.join(', ')}
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 4. PROCTORED EXAMS & QUIZZES                                              */}
      {/* ========================================================================= */}
      {activeEduTab === 'exam' && (
        <div className="bg-slate-950 border border-slate-800 p-6 rounded-3xl space-y-6">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
                <HelpCircle className="w-4 h-4 text-emerald-400" /> Proctored Final University Exam
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Score 5/6 to earn your On-Chain Soulbound Certificate NFT.</p>
            </div>
            {quizSubmitted && (
              <span className={`px-3 py-1 rounded-xl text-xs font-bold border ${
                quizScore >= 5 ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40' : 'bg-rose-500/20 text-rose-300 border-rose-500/40'
              }`}>
                Score: {quizScore} / {QUIZ_QUESTIONS.length} {quizScore >= 5 ? 'Passed ✓' : 'Failed ✕'}
              </span>
            )}
          </div>

          <div className="space-y-5 text-xs">
            {QUIZ_QUESTIONS.map((q, idx) => (
              <div key={q.id} className="p-4 bg-slate-900 border border-slate-800 rounded-2xl space-y-3">
                <div className="font-bold text-white flex items-center gap-2">
                  <span className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center text-[10px]">
                    {idx + 1}
                  </span>
                  <span>{q.question}</span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  {q.options.map((opt, oIdx) => {
                    const isSelected = userAnswers[q.id] === oIdx;
                    const isCorrect = q.correctIndex === oIdx;
                    let optStyle = 'bg-slate-950 text-slate-300 border-slate-800';
                    if (quizSubmitted) {
                      if (isCorrect) optStyle = 'bg-emerald-950/60 text-emerald-300 border-emerald-600';
                      else if (isSelected && !isCorrect) optStyle = 'bg-rose-950/60 text-rose-300 border-rose-600';
                    } else if (isSelected) {
                      optStyle = 'bg-emerald-600 text-white border-emerald-500';
                    }
                    return (
                      <button
                        key={oIdx}
                        onClick={() => handleAnswerSelect(q.id, oIdx)}
                        className={`p-3 rounded-xl text-left font-bold transition border cursor-pointer ${optStyle}`}
                      >
                        {opt}
                      </button>
                    );
                  })}
                </div>

                {quizSubmitted && (
                  <div className="text-[11px] text-slate-400 bg-slate-950 p-3 rounded-xl border border-slate-800">
                    <span className="font-bold text-amber-300">Explanation: </span>{q.explanation}
                  </div>
                )}
              </div>
            ))}
          </div>

          {!quizSubmitted ? (
            <button
              onClick={handleQuizSubmit}
              className="w-full bg-emerald-600 hover:bg-emerald-500 text-white font-bold py-3 rounded-2xl text-xs shadow-lg transition cursor-pointer"
            >
              Submit University Exam
            </button>
          ) : (
            quizScore >= 5 && (
              <button
                onClick={() => handleClaimCert('course-1')}
                disabled={claiming}
                className="w-full bg-amber-600 hover:bg-amber-500 text-white font-bold py-3 rounded-2xl text-xs shadow-lg transition cursor-pointer flex items-center justify-center gap-2"
              >
                <Award className="w-4 h-4 text-amber-300" />
                <span>Claim Soulbound Certificate NFT</span>
              </button>
            )
          )}
        </div>
      )}

      {/* ========================================================================= */}
      {/* 5. FINANCIAL LITERACY PROGRAM                                             */}
      {/* ========================================================================= */}
      {activeEduTab === 'literacy' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <div>
              <h3 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
                <DollarSign className="w-4 h-4 text-amber-400" /> Global Financial Literacy Program
              </h3>
              <p className="text-xs text-slate-400 mt-0.5">Core modules covering Savings, Debt & Interest, Budgeting, and Inflation.</p>
            </div>
            <span className="px-3 py-1 rounded-xl bg-amber-500/20 text-amber-300 border border-amber-500/30 text-xs font-bold">
              Literacy Grant Active
            </span>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {FINANCIAL_LITERACY_PROGRAM.map((m) => (
              <div key={m.id} className="bg-slate-950 border border-slate-800 p-5 rounded-3xl space-y-3">
                <div className="flex items-center justify-between">
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {m.topic}
                  </span>
                  <span className="text-[10px] text-slate-500">{m.readTime} read</span>
                </div>
                <h4 className="font-extrabold text-white text-sm">{m.title}</h4>
                <p className="text-xs text-slate-400">{m.description}</p>
                <div className="pt-2 border-t border-slate-800 flex justify-between items-center text-xs">
                  <span className={m.completed ? 'text-emerald-400 font-bold' : 'text-slate-500'}>
                    {m.completed ? 'Completed ✓' : 'Incomplete'}
                  </span>
                  <button className="text-amber-400 font-bold hover:underline cursor-pointer flex items-center gap-1">
                    Read Module <ChevronRight className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* 6. ON-CHAIN CERTIFICATE NFTS                                              */}
      {/* ========================================================================= */}
      {activeEduTab === 'certificates' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between border-b border-slate-800 pb-3">
            <h3 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
              <Award className="w-4 h-4 text-amber-400" /> Issued Soulbound Certificate NFTs ({certificates.length})
            </h3>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {certificates.map((cert) => (
              <div key={cert.id} className="bg-slate-950 border border-amber-500/40 p-6 rounded-3xl space-y-4 shadow-xl">
                <div className="flex items-center justify-between border-b border-slate-800 pb-3">
                  <div className="flex items-center gap-2">
                    <Award className="w-6 h-6 text-amber-400" />
                    <div>
                      <div className="text-xs font-bold text-amber-400">ABCDeFi University Certificate</div>
                      <div className="text-[10px] text-slate-500">{cert.tokenId}</div>
                    </div>
                  </div>
                  <span className="px-2.5 py-0.5 rounded-full text-[10px] font-bold bg-amber-500/20 text-amber-300 border border-amber-500/30">
                    {cert.level}
                  </span>
                </div>

                <div className="space-y-2 text-xs">
                  <div className="text-white font-extrabold text-base">{cert.courseTitle}</div>
                  <div className="text-slate-400 text-[11px]">Awarded to <span className="text-white font-bold">{cert.recipientName}</span></div>
                  <div className="text-slate-500 font-mono text-[10px]">Wallet: {cert.walletAddress}</div>
                  <div className="text-slate-500 text-[10px]">Issued Date: {cert.issuedDate}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

    </div>
  );
};

export default FinancialEducation;
