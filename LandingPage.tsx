import { Link } from 'react-router-dom'

export default function LandingPage() {
    return (
        <div className="min-h-screen bg-slate-50 text-slate-900 font-sans selection:bg-indigo-100 selection:text-indigo-700">
            {/* Navbar */}
            <nav className="fixed top-0 left-0 right-0 bg-white/80 backdrop-blur-md border-b border-slate-200 z-50">
                <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
                    <div className="flex items-center gap-2">
                        <span className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-lg shadow-lg shadow-indigo-200">
                            BB
                        </span>
                        <span className="text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-indigo-600 to-violet-600">
                            BragBoard
                        </span>
                    </div>
                    <div className="flex items-center gap-4">
                        <Link
                            to="/login"
                            className="text-sm font-medium text-slate-600 hover:text-indigo-600 transition-colors"
                        >
                            Log in
                        </Link>
                        <Link
                            to="/register"
                            className="px-4 py-2 text-sm font-medium text-white bg-slate-900 rounded-full hover:bg-slate-800 transition-all shadow-lg hover:shadow-xl hover:-translate-y-0.5"
                        >
                            Get Started
                        </Link>
                    </div>
                </div>
            </nav>

            {/* Hero Section */}
            <section className="pt-32 pb-20 px-6">
                <div className="max-w-7xl mx-auto text-center">
                    <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-indigo-50 border border-indigo-100 text-indigo-600 text-sm font-medium mb-8 animate-fade-in-up">
                        <span className="relative flex h-2 w-2">
                            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-indigo-400 opacity-75"></span>
                            <span className="relative inline-flex rounded-full h-2 w-2 bg-indigo-500"></span>
                        </span>
                        The new standard for team recognition
                    </div>

                    <h1 className="text-5xl md:text-7xl font-bold tracking-tight text-slate-900 mb-8 max-w-4xl mx-auto leading-tight">
                        Celebrate wins, <br />
                        <span className="text-transparent bg-clip-text bg-gradient-to-r from-indigo-600 via-violet-600 to-purple-600">
                            boost morale.
                        </span>
                    </h1>

                    <p className="text-xl text-slate-600 mb-10 max-w-2xl mx-auto leading-relaxed">
                        BragBoard is the modern way to share shout-outs, track achievements, and build a culture of appreciation in your team.
                    </p>

                    <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
                        <Link
                            to="/register"
                            className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-white bg-indigo-600 rounded-full hover:bg-indigo-500 transition-all shadow-xl shadow-indigo-200 hover:shadow-2xl hover:shadow-indigo-300 hover:-translate-y-1"
                        >
                            Create your account
                        </Link>
                        <Link
                            to="/login"
                            className="w-full sm:w-auto px-8 py-4 text-base font-semibold text-slate-700 bg-white border border-slate-200 rounded-full hover:bg-slate-50 transition-all hover:border-slate-300"
                        >
                            Sign in
                        </Link>
                    </div>
                </div>
            </section>

            {/* Stats Section */}
            <section className="py-12 bg-white border-y border-slate-100">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-8 text-center">
                        <div>
                            <div className="text-3xl font-bold text-slate-900 mb-1">10k+</div>
                            <div className="text-sm text-slate-500 font-medium">Shout-outs Sent</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-slate-900 mb-1">500+</div>
                            <div className="text-sm text-slate-500 font-medium">Teams Onboarded</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-slate-900 mb-1">98%</div>
                            <div className="text-sm text-slate-500 font-medium">Happiness Increase</div>
                        </div>
                        <div>
                            <div className="text-3xl font-bold text-slate-900 mb-1">24/7</div>
                            <div className="text-sm text-slate-500 font-medium">Positive Vibes</div>
                        </div>
                    </div>
                </div>
            </section>

            {/* Features Grid */}
            <section className="py-24 bg-slate-50">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-slate-900 mb-4">Everything you need to build culture</h2>
                        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
                            Powerful features designed to make recognition fun, easy, and impactful for everyone on the team.
                        </p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-8">
                        {/* Feature 1 */}
                        <div className="group p-8 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-indigo-100 transition-all duration-300">
                            <div className="h-14 w-14 rounded-2xl bg-blue-50 text-blue-600 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform duration-300">
                                📣
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Instant Shout-outs</h3>
                            <p className="text-slate-600 leading-relaxed">
                                Recognize your teammates in real-time. Share wins, big or small, and keep the positive energy flowing across the organization.
                            </p>
                        </div>

                        {/* Feature 2 */}
                        <div className="group p-8 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-purple-100 transition-all duration-300">
                            <div className="h-14 w-14 rounded-2xl bg-purple-50 text-purple-600 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform duration-300">
                                🏆
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Gamified Leaderboard</h3>
                            <p className="text-slate-600 leading-relaxed">
                                Track contributions and earn points. Friendly competition that drives engagement and ensures recognition never goes unnoticed.
                            </p>
                        </div>

                        {/* Feature 3 */}
                        <div className="group p-8 rounded-3xl bg-white border border-slate-100 shadow-sm hover:shadow-md hover:border-emerald-100 transition-all duration-300">
                            <div className="h-14 w-14 rounded-2xl bg-emerald-50 text-emerald-600 flex items-center justify-center text-3xl mb-6 group-hover:scale-110 transition-transform duration-300">
                                📊
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-3">Team Insights</h3>
                            <p className="text-slate-600 leading-relaxed">
                                Visualize team activity and identify top contributors with beautiful, real-time analytics. See who's making an impact.
                            </p>
                        </div>
                    </div>
                </div>
            </section>

            {/* How it Works */}
            <section className="py-24 bg-white border-t border-slate-100">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="text-center mb-16">
                        <h2 className="text-3xl font-bold text-slate-900 mb-4">How BragBoard works</h2>
                        <p className="text-lg text-slate-600">Simple steps to start celebrating success.</p>
                    </div>

                    <div className="grid md:grid-cols-3 gap-12 relative">
                        {/* Connecting Line (Desktop) */}
                        <div className="hidden md:block absolute top-12 left-0 w-full h-0.5 bg-gradient-to-r from-indigo-100 via-purple-100 to-indigo-100 -z-10"></div>

                        <div className="text-center">
                            <div className="h-24 w-24 rounded-full bg-white border-4 border-indigo-50 text-indigo-600 flex items-center justify-center text-3xl font-bold mx-auto mb-6 shadow-sm relative z-10">
                                1
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Create an Account</h3>
                            <p className="text-slate-600">Sign up in seconds and join your team's workspace.</p>
                        </div>
                        <div className="text-center">
                            <div className="h-24 w-24 rounded-full bg-white border-4 border-purple-50 text-purple-600 flex items-center justify-center text-3xl font-bold mx-auto mb-6 shadow-sm relative z-10">
                                2
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Send a Shout-out</h3>
                            <p className="text-slate-600">Tag a teammate and write a message celebrating their win.</p>
                        </div>
                        <div className="text-center">
                            <div className="h-24 w-24 rounded-full bg-white border-4 border-emerald-50 text-emerald-600 flex items-center justify-center text-3xl font-bold mx-auto mb-6 shadow-sm relative z-10">
                                3
                            </div>
                            <h3 className="text-xl font-bold text-slate-900 mb-2">Climb the Ranks</h3>
                            <p className="text-slate-600">Earn points, unlock badges, and see morale skyrocket.</p>
                        </div>
                    </div>
                </div>
            </section>

            {/* Testimonials */}
            <section className="py-24 bg-slate-50">
                <div className="max-w-7xl mx-auto px-6">
                    <h2 className="text-3xl font-bold text-slate-900 text-center mb-16">Loved by teams everywhere</h2>
                    <div className="grid md:grid-cols-2 gap-8">
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                            <div className="flex items-center gap-1 text-yellow-400 mb-4">
                                ★★★★★
                            </div>
                            <p className="text-lg text-slate-700 italic mb-6">
                                "BragBoard has completely transformed how we recognize each other. It's fun, easy, and the leaderboard gets everyone excited!"
                            </p>
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-indigo-100 flex items-center justify-center text-indigo-600 font-bold">
                                    JS
                                </div>
                                <div>
                                    <div className="font-bold text-slate-900">Sarah Jenkins</div>
                                    <div className="text-sm text-slate-500">Product Manager @ TechFlow</div>
                                </div>
                            </div>
                        </div>
                        <div className="bg-white p-8 rounded-3xl shadow-sm border border-slate-100">
                            <div className="flex items-center gap-1 text-yellow-400 mb-4">
                                ★★★★★
                            </div>
                            <p className="text-lg text-slate-700 italic mb-6">
                                "Finally, a way to track wins that doesn't feel like a chore. The insights help me see who the real MVPs are on my team."
                            </p>
                            <div className="flex items-center gap-4">
                                <div className="h-12 w-12 rounded-full bg-purple-100 flex items-center justify-center text-purple-600 font-bold">
                                    MR
                                </div>
                                <div>
                                    <div className="font-bold text-slate-900">Mike Ross</div>
                                    <div className="text-sm text-slate-500">Engineering Lead @ DevCorp</div>
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </section>

            {/* CTA Section */}
            <section className="py-24 px-6">
                <div className="max-w-7xl mx-auto">
                    <div className="rounded-[2.5rem] bg-slate-900 p-12 md:p-24 text-center relative overflow-hidden">
                        {/* Decorative blobs */}
                        <div className="absolute top-0 left-0 w-64 h-64 bg-indigo-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 -translate-x-1/2 -translate-y-1/2"></div>
                        <div className="absolute bottom-0 right-0 w-64 h-64 bg-purple-500 rounded-full mix-blend-multiply filter blur-3xl opacity-20 translate-x-1/2 translate-y-1/2"></div>

                        <h2 className="text-3xl md:text-5xl font-bold text-white mb-8 relative z-10">
                            Ready to transform your team culture?
                        </h2>
                        <p className="text-slate-400 text-lg mb-10 max-w-2xl mx-auto relative z-10">
                            Join thousands of teams using BragBoard to build stronger, happier, and more productive workplaces.
                        </p>
                        <Link
                            to="/register"
                            className="inline-flex items-center justify-center px-8 py-4 text-base font-semibold text-slate-900 bg-white rounded-full hover:bg-slate-100 transition-all shadow-xl relative z-10"
                        >
                            Get Started for Free
                        </Link>
                    </div>
                </div>
            </section>

            {/* Footer */}
            <footer className="bg-white border-t border-slate-100 py-12 px-6">
                <div className="max-w-7xl mx-auto flex flex-col md:flex-row items-center justify-between gap-6">
                    <div className="flex items-center gap-2">
                        <span className="h-6 w-6 rounded bg-indigo-600 flex items-center justify-center text-white font-bold text-xs">
                            BB
                        </span>
                        <span className="font-bold text-slate-900">BragBoard</span>
                    </div>
                    <p className="text-slate-500 text-sm">
                        © {new Date().getFullYear()} BragBoard. All rights reserved.
                    </p>
                    <div className="flex gap-6 text-sm text-slate-500">
                        <a href="#" className="hover:text-indigo-600 transition-colors">Privacy</a>
                        <a href="#" className="hover:text-indigo-600 transition-colors">Terms</a>
                        <a href="#" className="hover:text-indigo-600 transition-colors">Contact</a>
                    </div>
                </div>
            </footer>
        </div>
    )
}
