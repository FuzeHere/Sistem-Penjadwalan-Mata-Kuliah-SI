import '../styles/global.css';

export const metadata = {
  title: 'SI-Schedule - UIN Alauddin Makassar',
  description: 'Sistem Manajemen Penjadwalan Perkuliahan Program Studi Sistem Informasi UIN Alauddin Makassar.',
};

export default function RootLayout({ children }) {
  return (
    <html lang="id">
      <body className="animate-fade">
        {children}
      </body>
    </html>
  );
}
