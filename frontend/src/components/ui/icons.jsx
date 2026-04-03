// Lightweight inline SVG icons — no external library needed

export function IconGrid({ className }) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1" y="1" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="10.5" y="1" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="1" y="10.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      <rect x="10.5" y="10.5" width="6.5" height="6.5" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}

export function IconSearch({ className }) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="8" cy="8" r="5.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M12.5 12.5L16 16" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function IconCalendar({ className }) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <rect x="1.5" y="3" width="15" height="13.5" rx="2" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M1.5 7.5h15" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M6 1.5V4.5M12 1.5V4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function IconTicket({ className }) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M1.5 6.75A2.25 2.25 0 0 1 3.75 4.5h10.5A2.25 2.25 0 0 1 16.5 6.75v1.5a1.5 1.5 0 0 0 0 3v1.5a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 12.75v-1.5a1.5 1.5 0 0 0 0-3v-1.5Z" stroke="currentColor" strokeWidth="1.5"/>
    </svg>
  )
}

export function IconMessage({ className }) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M15.75 9a6.75 6.75 0 1 1-13.5 0 6.75 6.75 0 0 1 13.5 0Z" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M6 9h.01M9 9h.01M12 9h.01" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
    </svg>
  )
}

export function IconBell({ className }) {
  return (
    <svg className={className} viewBox="0 0 18 18" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M9 1.5a5.25 5.25 0 0 0-5.25 5.25c0 2.888-.862 4.681-1.612 5.625A.75.75 0 0 0 2.738 13.5h12.524a.75.75 0 0 0 .6-1.125c-.75-.944-1.612-2.737-1.612-5.625A5.25 5.25 0 0 0 9 1.5Z" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M7.5 15a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function IconChevronLeft({ className }) {
  return (
    <svg className={className} viewBox="0 0 16 16" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 12L6 8l4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  )
}

export function IconMapPin({ className }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M7 1.5A3.5 3.5 0 0 1 10.5 5c0 2.5-3.5 7.5-3.5 7.5S3.5 7.5 3.5 5A3.5 3.5 0 0 1 7 1.5Z" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="7" cy="5" r="1.2" stroke="currentColor" strokeWidth="1.2"/>
    </svg>
  )
}

export function IconUsers({ className }) {
  return (
    <svg className={className} viewBox="0 0 14 14" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="5.5" cy="4.5" r="2" stroke="currentColor" strokeWidth="1.3"/>
      <path d="M1.5 12c0-2.21 1.79-4 4-4s4 1.79 4 4" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
      <path d="M9.5 6.5a2 2 0 1 0 0-4M12.5 12c0-1.86-1.28-3.43-3-3.87" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
    </svg>
  )
}

export function IconNotification({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M10 2a6 6 0 0 0-6 6c0 3.3-.986 5.357-1.843 6.429A.857.857 0 0 0 2.843 15.5h14.314a.857.857 0 0 0 .686-1.071C16.986 13.357 16 11.3 16 8a6 6 0 0 0-6-6Z" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M8.5 17.5a1.5 1.5 0 0 0 3 0" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}

export function IconUser({ className }) {
  return (
    <svg className={className} viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg">
      <circle cx="10" cy="7" r="3.5" stroke="currentColor" strokeWidth="1.5"/>
      <path d="M3 18c0-3.866 3.134-7 7-7s7 3.134 7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
    </svg>
  )
}
