export function Footer() {
  return (
    <footer className="border-t py-6">
      <div className="container mx-auto px-4 text-center text-sm text-muted-foreground">
        <p>© {new Date().getFullYear()} My Fullstack App. 全栈项目模板.</p>
      </div>
    </footer>
  );
}
