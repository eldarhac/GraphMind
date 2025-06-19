// This is a mock User entity. In a real application, this would be
// handled by an authentication system.
export const User = {
  me: () => {
    return Promise.resolve({
      id: 'c3d4e5f6-a7b8-9012-3456-7890abcdef2',
      email: 'jian.li@quantumleap.com',
      full_name: 'Dr. Jian Li'
    });
  }
}; 