import React from 'react'

export function PageHeader({ title, subtitle, action }) {
  return (
    <div className="flex items-start justify-between mb-6">
      <div>
        <h2 className="text-2xl font-bold text-white">{title}</h2>
        {subtitle && <p className="text-sm text-gray-400 mt-1">{subtitle}</p>}
      </div>
      {action}
    </div>
  )
}

export function StatCard({ label, value, sub, color = 'indigo' }) {
  const colors = {
    indigo: 'border-indigo-500 text-indigo-400',
    red: 'border-red-500 text-red-400',
    yellow: 'border-yellow-500 text-yellow-400',
    green: 'border-green-500 text-green-400',
    blue: 'border-blue-500 text-blue-400',
  }
  return (
    <div className={`bg-gray-900 rounded-xl p-4 border-l-4 ${colors[color]}`}>
      <p className="text-xs text-gray-400 uppercase tracking-wider">{label}</p>
      <p className={`text-3xl font-bold mt-1 ${colors[color].split(' ')[1]}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  )
}

export function Badge({ label, color = 'gray' }) {
  const map = {
    gray:   'bg-gray-700 text-gray-300',
    red:    'bg-red-900/60 text-red-300',
    yellow: 'bg-yellow-900/60 text-yellow-300',
    green:  'bg-green-900/60 text-green-300',
    blue:   'bg-blue-900/60 text-blue-300',
    indigo: 'bg-indigo-900/60 text-indigo-300',
    purple: 'bg-purple-900/60 text-purple-300',
  }
  return (
    <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${map[color] || map.gray}`}>
      {label}
    </span>
  )
}

export function Button({ children, onClick, variant = 'primary', size = 'sm', disabled = false, className = '' }) {
  const variants = {
    primary:  'bg-indigo-600 hover:bg-indigo-500 text-white',
    danger:   'bg-red-700 hover:bg-red-600 text-white',
    success:  'bg-green-700 hover:bg-green-600 text-white',
    ghost:    'bg-gray-800 hover:bg-gray-700 text-gray-300',
  }
  const sizes = { sm: 'px-3 py-1.5 text-xs', md: 'px-4 py-2 text-sm' }
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className={`rounded-lg font-medium transition-colors disabled:opacity-40 disabled:cursor-not-allowed
        ${variants[variant]} ${sizes[size]} ${className}`}
    >
      {children}
    </button>
  )
}

export function Card({ children, className = '' }) {
  return (
    <div className={`bg-gray-900 rounded-xl border border-gray-800 ${className}`}>
      {children}
    </div>
  )
}

export function Loader() {
  return (
    <div className="flex items-center justify-center h-40">
      <div className="w-8 h-8 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
    </div>
  )
}

export function EmptyState({ message }) {
  return (
    <div className="flex flex-col items-center justify-center h-40 text-gray-500">
      <p className="text-sm">{message}</p>
    </div>
  )
}
