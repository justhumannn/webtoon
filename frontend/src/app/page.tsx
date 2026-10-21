import { BadgeMaker } from "@/components/BadgeMaker";

export default function Home() {
  return (
    <main className="mx-auto w-full max-w-[960px] px-4 py-10 sm:px-6">
      <header className="mb-8">
        <h1 className="text-[24px] font-extrabold tracking-tight">웹툰 찐팬 배지 이미지 만들기</h1>
        <p className="mt-1 text-[14px] text-muted">
          네이버웹툰 찐팬 배지 목록을 한 장의 이미지로 만들어 저장하세요.
        </p>
      </header>
      <BadgeMaker />
    </main>
  );
}
