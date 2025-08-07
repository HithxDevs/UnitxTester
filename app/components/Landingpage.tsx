'use client';

import { FaGithub, FaPlay, FaMagic, FaCodeBranch, FaCogs, FaUsers, FaCheck, FaBars, FaTimes } from 'react-icons/fa';
import RepoExplorerSection from './RepositoryExplorer';
import { SessionProvider } from "next-auth/react";
import { useState, useEffect } from 'react';

//@ts-ignore
export const LandingPage = ({ session }) => {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 10);
    };
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  return (
    <SessionProvider session={session}>
      <div className="min-h-screen flex flex-col bg-gradient-to-b from-gray-50 to-white">
        {/* Header/Navigation */}
        <header className={`fixed w-full z-50 transition-all duration-300 ${scrolled ? 'bg-white shadow-sm py-2' : 'bg-transparent py-4'}`}>
          <nav className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 flex justify-between items-center">
            <div className="text-2xl font-bold text-indigo-600 flex items-center">
              <FaMagic className="mr-2" /> UnitxTester
            </div>
            
            {/* Desktop Navigation */}
            <div className="hidden md:flex items-center space-x-8">
      
              <a href="#how-it-works" className="text-gray-600 hover:text-indigo-600 transition-colors">How It Works</a>
              <a href="#about" className="text-gray-600 hover:text-indigo-600 transition-colors">About</a>
              <a 
                href="https://github.com/hithxdevs/unitxtester" 
                className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                target="_blank"
                rel="noopener noreferrer"
              >
                <FaGithub className="mr-2" /> GitHub
              </a>
              <a 
                href="#explorer" 
                className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg"
              >
                Get Started
              </a>
            </div>

            {/* Mobile Menu Button */}
            <button 
              className="md:hidden text-gray-600 focus:outline-none"
              onClick={() => setIsMenuOpen(!isMenuOpen)}
            >
              {isMenuOpen ? <FaTimes size={24} /> : <FaBars size={24} />}
            </button>
          </nav>

          {/* Mobile Menu */}
          {isMenuOpen && (
            <div className="md:hidden bg-white shadow-lg rounded-b-lg px-4 py-2">
              <div className="flex flex-col space-y-4 py-4">
                
                <a 
                  href="#how-it-works" 
                  className="text-gray-600 hover:text-indigo-600 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  How It Works
                </a>
                <a 
                  href="#about" 
                  className="text-gray-600 hover:text-indigo-600 transition-colors"
                  onClick={() => setIsMenuOpen(false)}
                >
                  About
                </a>
                <a 
                  href="https://github.com/hithxdevs/unitxtester" 
                  className="flex items-center text-gray-600 hover:text-gray-900 transition-colors"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={() => setIsMenuOpen(false)}
                >
                  <FaGithub className="mr-2" /> GitHub
                </a>
                <a 
                  href="#explorer" 
                  className="bg-indigo-600 text-white px-4 py-2 rounded-md hover:bg-indigo-700 transition-colors w-full text-center"
                  onClick={() => setIsMenuOpen(false)}
                >
                  Get Started
                </a>
              </div>
            </div>
          )}
        </header>

        {/* Hero Section */}
        <section className="pt-40 pb-20 px-4 sm:px-6 lg:px-8 max-w-7xl mx-auto text-center">
          <h1 className="text-4xl md:text-6xl font-bold text-gray-900 mb-6">
            AI-Powered Test Case Generation <br />
            <span className="text-indigo-600">for Modern Developers</span>
          </h1>
          <p className="text-xl text-gray-600 max-w-3xl mx-auto mb-10">
            Automatically generate comprehensive test cases for your GitHub repositories.
            Improve code quality and reduce manual testing effort with UnitxTester.
          </p>
          <div className="flex flex-col sm:flex-row justify-center gap-4 mb-16">
            <a 
              href="#explorer" 
              className="bg-indigo-600 text-white px-6 py-3 rounded-lg hover:bg-indigo-700 transition-colors shadow-md hover:shadow-lg flex items-center justify-center"
            >
              <FaPlay className="mr-2" /> Try It Now
            </a>
            <a 
              href="https://github.com/hithxdevs/unitxtester" 
              className="bg-white text-gray-700 px-6 py-3 rounded-lg hover:bg-gray-50 transition-colors border border-gray-200 shadow-sm hover:shadow-md flex items-center justify-center"
              target="_blank"
              rel="noopener noreferrer"
            >
              <FaGithub className="mr-2" /> View on GitHub
            </a>
          </div>
        </section>

        {/* Repository Explorer Section */}
        <section id="explorer" className="py-16 bg-gray-50 w-full">
  <div className="mx-4 sm:mx-6 lg:mx-8 xl:mx-auto xl:max-w-7xl">
    <div className="text-center mb-12">
      <h2 className="text-3xl md:text-4xl font-bold text-gray-900 mb-4">
        Explore Your Repository
      </h2>
      <p className="text-xl text-gray-600 max-w-3xl mx-auto">
        Connect your GitHub account to browse your repositories and generate test cases.
      </p>
    </div>

    <div className="w-full bg-white p-6 shadow-xl border-y border-gray-200">
      <RepoExplorerSection />
      
      <div className="mt-6 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <FaCheck className="text-green-500" />
          <span>Supports JavaScript, TypeScript, Python, and more</span>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <FaCheck className="text-green-500" />
          <span>Private repository support</span>
        </div>
        <div className="flex items-center space-x-2 text-sm text-gray-500">
          <FaCheck className="text-green-500" />
          <span>Collaborative testing</span>
        </div>
      </div>
    </div>
  </div>
</section>

        
        {/* How It Works Section */}
        <section id="how-it-works" className="py-20 px-4 sm:px-6 lg:px-8 bg-gray-50">
          <div className="max-w-7xl mx-auto">
            <h2 className="text-3xl md:text-4xl font-bold text-center text-gray-900 mb-16">
              How It Works
            </h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
              {[
                {
                  step: "1",
                  title: "Connect Your Repository",
                  description: "Sign in with GitHub and select the repository you want to test"
                },
                {
                  step: "2",
                  title: "Select Files to Test",
                  description: "Browse your repository and choose which files need test coverage"
                },
                {
                  step: "3",
                  title: "Generate & Review",
                  description: "Our AI generates comprehensive test cases that you can review and customize"
                }
              ].map((step, index) => (
                <div key={index} className="bg-white p-6 rounded-xl shadow-sm hover:shadow-md transition-shadow">
                  <div className="flex items-center mb-4">
                    <div className="bg-indigo-600 text-white font-bold rounded-full h-10 w-10 flex items-center justify-center mr-4">
                      {step.step}
                    </div>
                    <h3 className="text-xl font-semibold text-gray-800">{step.title}</h3>
                  </div>
                  <p className="text-gray-600">{step.description}</p>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* CTA Section */}
        <section className="py-20 px-4 sm:px-6 lg:px-8 bg-indigo-600 text-white">
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-3xl md:text-4xl font-bold mb-6">Ready to Transform Your Testing Process?</h2>
            <p className="text-xl mb-10 opacity-90">
              Start generating professional test cases for your projects today. No credit card required.
            </p>
            <a 
              href="#explorer" 
              className="inline-block bg-white text-indigo-600 px-8 py-4 rounded-lg hover:bg-gray-100 transition-colors shadow-lg hover:shadow-xl font-semibold text-lg"
            >
              Get Started for Free
            </a>
          </div>
        </section>

        {/* Footer */}
        <footer className="py-12 px-4 sm:px-6 lg:px-8 bg-gray-900 text-white">
          <div className="max-w-7xl mx-auto grid grid-cols-1 md:grid-cols-4 gap-8">
            <div>
              <h3 className="text-xl font-bold mb-4 flex items-center">
                <FaMagic className="mr-2" /> UnitxTester
              </h3>
              <p className="text-gray-400">
                AI-powered test generation for quality-focused development teams.
              </p>
            </div>
            <div>
              <h4 className="font-semibold text-lg mb-4">Product</h4>
              <ul className="space-y-2">
  
                <li><a href="#how-it-works" className="text-gray-400 hover:text-white transition-colors">How It Works</a></li>
                <li><a href="#explorer" className="text-gray-400 hover:text-white transition-colors">Demo</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-lg mb-4">Resources</h4>
              <ul className="space-y-2">
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Documentation</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Blog</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Support</a></li>
              </ul>
            </div>
            <div>
              <h4 className="font-semibold text-lg mb-4">Connect</h4>
              <ul className="space-y-2">
                <li>
                  <a 
                    href="https://github.com/hithxdevs/unitxtester" 
                    className="flex items-center text-gray-400 hover:text-white transition-colors"
                    target="_blank"
                    rel="noopener noreferrer"
                  >
                    <FaGithub className="mr-2" /> GitHub
                  </a>
                </li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Twitter</a></li>
                <li><a href="#" className="text-gray-400 hover:text-white transition-colors">Contact</a></li>
              </ul>
            </div>
          </div>
          <div className="max-w-7xl mx-auto mt-12 pt-8 border-t border-gray-800 text-center text-gray-400">
            <p>&copy; {new Date().getFullYear()} UnitxTester. All rights reserved.</p>
          </div>
        </footer>
      </div>
    </SessionProvider>
  );
};