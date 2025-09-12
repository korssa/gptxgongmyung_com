"use client";

import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Plus, Edit, Trash2, EyeOff, Eye, Calendar, User, FileText, ArrowLeft } from "lucide-react";
import { ContentItem, ContentFormData, ContentType } from "@/types";
import { useAdmin } from "@/hooks/use-admin";
import { uploadFile } from "@/lib/storage-adapter";
import { blockTranslationFeedback, createAdminButtonHandler } from "@/lib/translation-utils";
import { loadContentsFromBlob, loadContentsByTypeFromBlob } from "@/lib/data-loader";
import { loadMemoDraft, saveMemoDraft, clearMemoDraft } from "@/lib/memo-storage";

interface AppStoryListProps {
  type: string; // "appstory"
  onBack?: () => void;
}

export function AppStoryList({ type, onBack }: AppStoryListProps) {
  const [contents, setContents] = useState<ContentItem[]>([]);
  const [selected, setSelected] = useState<ContentItem | null>(null);
  const [loading, setLoading] = useState(true);
  const [isDialogOpen, setIsDialogOpen] = useState(false);
  const [editingContent, setEditingContent] = useState<ContentItem | null>(null);
  const [formData, setFormData] = useState<ContentFormData>({
    title: "",
    content: "",
    author: "",
    type: type as ContentType, // props로 받은 type 사용
    tags: "",
    isPublished: true, // 기본값을 true로 설정하여 게시되도록 함
  });
  const [selectedImage, setSelectedImage] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);

  const { isAuthenticated } = useAdmin();



  // 위젯 토글 시 메모 저장 브로드캐스트 수신
  useEffect(() => {
    const handler = () => {
      saveMemoDraft(type, {
        title: formData.title,
        content: formData.content,
        author: formData.author,
        tags: formData.tags,
        isPublished: formData.isPublished,
      });
    };
    window.addEventListener('memo:save-draft', handler);
    return () => window.removeEventListener('memo:save-draft', handler);
  }, [type, formData.title, formData.content, formData.author, formData.tags, formData.isPublished]);

  // 폼 로컬 캐시 복원
  useEffect(() => {
    const draft = loadMemoDraft(type);
    if (draft) {
      setFormData(prev => ({
        ...prev,
        title: draft.title ?? prev.title,
        content: draft.content ?? prev.content,
        author: draft.author ?? prev.author,
        tags: draft.tags ?? prev.tags,
        isPublished: typeof draft.isPublished === 'boolean' ? draft.isPublished : prev.isPublished,
      }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [type]);

      // 폼 변경 즉시 저장
    useEffect(() => {
      saveMemoDraft(type, {
        title: formData.title,
        content: formData.content,
        author: formData.author,
        tags: formData.tags,
        isPublished: formData.isPublished,
      });
    }, [type, formData.title, formData.content, formData.author, formData.tags, formData.isPublished]);

  // Load content list
  useEffect(() => {
    const load = async () => {
      try {
        setLoading(true);
        
        // 먼저 타입별 분리된 Blob Storage에서 로드 시도
        const typeContents = await loadContentsByTypeFromBlob(type as 'appstory' | 'news');
        
        if (typeContents.length > 0) {
          // 관리자일 경우 전체 콘텐츠, 일반 사용자는 게시된 콘텐츠만 표시
          setContents(isAuthenticated ? typeContents : typeContents.filter((c: ContentItem) => c.isPublished));
        } else {
          // 타입별 분리 API에 데이터가 없으면 기존 API 사용
          const res = await fetch(`/api/content?type=${type}`);
          const data = await res.json();
          // 관리자일 경우 전체 콘텐츠, 일반 사용자는 게시된 콘텐츠만 표시
          setContents(isAuthenticated ? data : data.filter((c: ContentItem) => c.isPublished));
        }
      } catch (err) {
        // Failed to load contents
      } finally {
        setLoading(false);
      }
    };
    load();

    // 번역 피드백 차단 함수
    const blockTranslationFeedback = () => {
      try {
        const selectors = [
          '[class*="goog-"]',
          '[id*="goog-"]',
        ];
        selectors.forEach(selector => {
          document.querySelectorAll(selector).forEach(el => {
            Object.assign((el as HTMLElement).style, {
              display: 'none',
              visibility: 'hidden',
              opacity: '0',
              pointerEvents: 'none',
              position: 'absolute',
              zIndex: '-9999',
              left: '-9999px',
              top: '-9999px',
            });
          });
        });
      } catch {
        // 에러 무시
      }
    };

    // DOM 변화 감지 후 제거
    const observer = new MutationObserver(() => blockTranslationFeedback());
    observer.observe(document.body, {
      childList: true,
      subtree: true,
    });

    // 최초 실행
    blockTranslationFeedback();

    return () => observer.disconnect();
  }, [type]);

  // 폼 초기화
  const resetForm = () => {
    setFormData({
      title: "",
      content: "",
      author: "",
      type: type as ContentType, // props로 받은 type 사용
      tags: "",
      isPublished: true, // 기본값을 true로 설정
    });
    setEditingContent(null);
    setSelectedImage(null);
    setImagePreview(null);
    clearMemoDraft(type); // 동적으로 메모 키 사용
  };

  // 이미지 선택 핸들러
  const handleImageSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file && file.type.startsWith('image/')) {
      setSelectedImage(file);
      const url = URL.createObjectURL(file);
      setImagePreview(url);
    }
  };

  // 이미지 제거 핸들러
  const handleRemoveImage = () => {
    setSelectedImage(null);
    if (imagePreview) {
      URL.revokeObjectURL(imagePreview);
      setImagePreview(null);
    }
  };

    // 콘텐츠 저장
  const handleSubmit = async () => {
    try {
      // 필수 필드 검증
      if (!formData.title.trim()) {
        alert('제목을 입력해주세요.');
        return;
      }
      if (!formData.author.trim()) {
        alert('작성자를 입력해주세요.');
        return;
      }
      if (!formData.content.trim()) {
        alert('내용을 입력해주세요.');
        return;
      }

      let imageUrl = null;

      // 이미지가 선택된 경우 업로드
      if (selectedImage) {
        try {
          imageUrl = await uploadFile(selectedImage, 'content-images');
        } catch (error) {
          throw new Error('이미지 업로드에 실패했습니다.');
        }
      }

      const url = editingContent ? `/api/content` : `/api/content`;
      const method = editingContent ? 'PUT' : 'POST';
      const body = editingContent 
        ? { id: editingContent.id, ...formData, imageUrl } 
        : { ...formData, imageUrl };

      const response = await fetch(url, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (response.ok) {
        const result = await response.json();
        
        setIsDialogOpen(false);
        clearMemoDraft(type);
        resetForm();
        
        // 콘텐츠 목록 다시 로드 (타입별로 정확히 필터링)
        try {
          const res = await fetch(`/api/content?type=${type}`);
          if (res.ok) {
            const data = await res.json();
            // 관리자일 경우 전체 콘텐츠, 일반 사용자는 게시된 콘텐츠만 표시
            setContents(isAuthenticated ? data : data.filter((c: ContentItem) => c.isPublished));
          }
              } catch (error) {
        // 목록 새로고침 실패
      }
        
        alert(editingContent ? 'App Story가 수정되었습니다.' : 'App Story가 저장되었습니다.');
      } else {
        const responseText = await response.text();
        
        let errorData;
        try {
          errorData = JSON.parse(responseText);
        } catch (parseError) {
          errorData = { error: responseText || '알 수 없는 오류' };
        }
        
        const errorMessage = errorData.details ? `${errorData.error}: ${errorData.details}` : errorData.error || '저장에 실패했습니다.';
        throw new Error(errorMessage);
      }
    } catch (error) {
      alert(error instanceof Error ? error.message : 'App Story 저장에 실패했습니다.');
    }
  };

  // 콘텐츠 삭제
  const handleDelete = async (id: string) => {
    if (!confirm('정말 삭제하시겠습니까?')) return;

    try {
      const response = await fetch(`/api/content?id=${id}`, {
        method: 'DELETE',
      });

      if (response.ok) {
        console.log(`✅ ${type} 삭제 완료: ${id}`);
        // 콘텐츠 목록 다시 로드 (타입별로 정확히 필터링)
        try {
          const res = await fetch(`/api/content?type=${type}`);
          if (res.ok) {
            const data = await res.json();
            // 관리자일 경우 전체 콘텐츠, 일반 사용자는 게시된 콘텐츠만 표시
            setContents(isAuthenticated ? data : data.filter((c: ContentItem) => c.isPublished));
          }
        } catch (error) {
          console.error('삭제 후 목록 새로고침 실패:', error);
        }
        
        alert('App Story가 삭제되었습니다.');
      }
    } catch {
      // 삭제 실패
    }
  };

  // 편집 모드 시작
  const handleEdit = (content: ContentItem) => {
    setEditingContent(content);
    setFormData({
      title: content.title,
      content: content.content,
      author: content.author,
      type: content.type,
      tags: content.tags?.join(', ') || "",
      isPublished: content.isPublished,
    });
    setIsDialogOpen(true);
  };

  // 게시 상태 토글
  const togglePublish = async (content: ContentItem) => {
    try {
      const response = await fetch('/api/content', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          id: content.id,
          isPublished: !content.isPublished,
        }),
      });

      if (response.ok) {
        // 콘텐츠 목록 다시 로드 (타입별로 정확히 필터링)
        try {
          const res = await fetch(`/api/content?type=${type}`);
          if (res.ok) {
            const data = await res.json();
            // 관리자일 경우 전체 콘텐츠, 일반 사용자는 게시된 콘텐츠만 표시
            setContents(isAuthenticated ? data : data.filter((c: ContentItem) => c.isPublished));
          }
              } catch (error) {
        // 토글 후 목록 새로고침 실패
      }
      }
    } catch {
      // 토글 실패
    }
  };

    // If content selected, show detail view
  if (selected) {
    return (
      <div className="w-full space-y-6 px-4" onMouseEnter={blockTranslationFeedback}>
                 {/* 상단 버튼 */}
         <Button 
           onClick={() => {
             setSelected(null);
             // 상단으로 빠르게 스크롤
             window.scrollTo({ top: 0, behavior: 'smooth' });
           }} 
           variant="outline" 
           className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-black hover:from-yellow-300 hover:to-yellow-500 border-2 border-yellow-400 hover:border-yellow-300 transition-all duration-200 font-bold shadow-lg hover:shadow-yellow-400/25"
           onMouseEnter={blockTranslationFeedback}
         >
           <span className="notranslate" translate="no">🏠 홈실볼+HOME</span>
         </Button>

        <div className="w-full flex justify-center">
          <div className="w-full max-w-2xl">
            {/* 헤더 정보 */}
            <div className="text-white border-b border-gray-600 pb-4 mb-6" onMouseEnter={blockTranslationFeedback}>
                             <h1 className="text-3xl font-bold mb-2" translate="no">{selected.title}</h1>
              <div className="flex gap-4 text-sm text-gray-400">

                                 <span className="flex items-center gap-1">
                   <User className="w-4 h-4" /> <span translate="no">{selected.author}</span>
                 </span>
                                 <span className="flex items-center gap-1">
                   <Calendar className="w-4 h-4" />
                   {new Date(selected.publishDate).toLocaleDateString()}
                 </span>
              </div>
            </div>

                          {/* 본문 콘텐츠 */}
              <article className="text-left text-gray-300 leading-relaxed space-y-6" onMouseEnter={blockTranslationFeedback}>
                                {/* 이미지가 있으면 본문 시작 부분에 배치 */}
                 {selected.imageUrl && (
                   <div className="flex justify-start mb-6">
                     <img
                       src={selected.imageUrl}
                       alt={selected.title}
                       className="max-w-xs h-auto rounded shadow-lg"
                       style={{ maxHeight: '300px' }}
                     />
                   </div>
                 )}

                                 {/* 본문 텍스트 */}
                 <pre
                   className="whitespace-pre-wrap font-mono preserve-format"
                   style={{
                     whiteSpace: 'pre-wrap',
                     wordBreak: 'keep-all',
                     wordWrap: 'break-word',
                     fontFamily: 'monospace'
                   }}
                 >
                   {selected.content}
                 </pre>
              </article>

                           {/* 태그 */}
              {selected.tags && selected.tags.length > 0 && (
                <div className="flex gap-2 flex-wrap mt-6 pt-4 border-t border-gray-600" onMouseEnter={blockTranslationFeedback}>
                  {selected.tags.map((tag, index) => (
                    <span
                      key={index}
                      className="px-3 py-1 bg-white text-black rounded-full text-sm"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              )}
           </div>
         </div>

                 {/* 하단 버튼 */}
         <Button 
           onClick={() => {
             setSelected(null);
             // 상단으로 빠르게 스크롤
             window.scrollTo({ top: 0, behavior: 'smooth' });
           }} 
           variant="outline" 
           className="bg-gradient-to-r from-yellow-400 to-yellow-600 text-black hover:from-yellow-300 hover:to-yellow-500 border-2 border-yellow-400 hover:border-yellow-300 transition-all duration-200 font-bold shadow-lg hover:shadow-yellow-400/25"
           onMouseEnter={blockTranslationFeedback}
         >
           <span className="notranslate" translate="no">🏠 홈실볼+HOME</span>
         </Button>
       </div>
     );
   }

  // Loading state
  if (loading) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4">
        <div className="text-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-amber-400 mx-auto"></div>
          <p className="text-gray-400 mt-4">App Story를 불러오는 중...</p>
        </div>
      </div>
    );
  }

  // Empty state
  if (contents.length === 0) {
    return (
      <div className="w-full max-w-4xl mx-auto px-4">
        <div className="text-center py-12">
          <h3 className="text-xl font-semibold text-gray-300 mb-2">App Story가 없습니다</h3>
          <p className="text-gray-400 mb-6">곧 새로운 App Story가 추가될 예정입니다.</p>
          
          {/* 관리자 모드에서만 추가 버튼 표시 */}
          {isAuthenticated && (
                         <div className="mt-6">
               <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
                 <DialogTrigger asChild>
                   <Button 
                     onClick={resetForm}
                     className="gap-2"
                     onMouseEnter={blockTranslationFeedback}
                   >
                     <Plus className="h-4 w-4" />
                     새 App Story 작성
                   </Button>
                 </DialogTrigger>
                 <DialogContent 
                   className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto"
                   onMouseEnter={blockTranslationFeedback}
                 >
                  <DialogHeader>
                    <DialogTitle>
                      {editingContent ? 'App Story 수정' : '새 App Story 작성'}
                    </DialogTitle>
                    <DialogDescription>
                      앱 개발 과정과 이야기를 작성하세요.
                    </DialogDescription>
                  </DialogHeader>
                  
                  <div className="space-y-4">
                    <div onMouseEnter={blockTranslationFeedback}>
                      <label htmlFor="title" className="block text-sm font-medium mb-2">제목 *</label>
                      <Input
                        id="title"
                        name="title"
                        value={formData.title}
                        onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                        placeholder="제목을 입력하세요"
                        onMouseEnter={blockTranslationFeedback}
                      />
                    </div>

                    <div onMouseEnter={blockTranslationFeedback}>
                      <label htmlFor="author" className="block text-sm font-medium mb-2">작성자 *</label>
                      <Input
                        id="author"
                        name="author"
                        value={formData.author}
                        onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                        placeholder="작성자명을 입력하세요"
                        onMouseEnter={blockTranslationFeedback}
                      />
                    </div>

                    <div onMouseEnter={blockTranslationFeedback}>
                      <label htmlFor="content" className="block text-sm font-medium mb-2">내용 *</label>
                      <Textarea
                        id="content"
                        name="content"
                        value={formData.content}
                        onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                        placeholder="내용을 입력하세요 (마크다운 지원)"
                        rows={10}
                        onMouseEnter={blockTranslationFeedback}
                      />
                    </div>

                    <div onMouseEnter={blockTranslationFeedback}>
                      <label htmlFor="tags" className="block text-sm font-medium mb-2">태그</label>
                      <Input
                        id="tags"
                        name="tags"
                        value={formData.tags}
                        onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                        placeholder="태그를 쉼표로 구분하여 입력하세요"
                        onMouseEnter={blockTranslationFeedback}
                      />
                    </div>

                    <div>
                      <label className="block text-sm font-medium mb-2">대표 이미지 (선택사항)</label>
                      <div className="space-y-2">
                        <input
                          id="image-upload"
                          type="file"
                          accept="image/*"
                          onChange={handleImageSelect}
                          className="hidden"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={() => document.getElementById('image-upload')?.click()}
                            className="px-3 py-2 text-sm bg-gray-800 border border-gray-600 text-gray-300 hover:border-amber-400 rounded transition-colors"
                          >
                            이미지 선택
                          </button>
                          {selectedImage && (
                            <button
                              type="button"
                              onClick={handleRemoveImage}
                              className="px-3 py-2 text-sm bg-red-600 border border-red-600 text-white hover:bg-red-700 rounded transition-colors"
                            >
                              제거
                            </button>
                          )}
                        </div>
                        {imagePreview && (
                          <div className="mt-2">
                            <img
                              src={imagePreview}
                              alt="미리보기"
                              className="w-32 h-32 object-cover rounded border"
                            />
                          </div>
                        )}
                      </div>
                    </div>

                    <div className="flex items-center space-x-2 p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                      <input
                        type="checkbox"
                        id="isPublished"
                        checked={formData.isPublished}
                        onChange={(e) => setFormData(prev => ({ ...prev, isPublished: e.target.checked }))}
                        className="w-4 h-4 text-amber-400 bg-gray-800 border-gray-600 rounded focus:ring-amber-400 focus:ring-2"
                      />
                      <label htmlFor="isPublished" className="text-sm font-medium text-white">
                        게시하기 (체크 시 App Story 목록에 표시)
                      </label>
                    </div>
                  </div>

                                     <DialogFooter>
                     <Button 
                       variant="outline" 
                       onClick={() => setIsDialogOpen(false)}
                       onMouseEnter={blockTranslationFeedback}
                     >
                       취소
                     </Button>
                     <Button 
                       onClick={handleSubmit}
                       onMouseEnter={blockTranslationFeedback}
                     >
                       {editingContent ? '수정' : '저장'}
                     </Button>
                   </DialogFooter>
                 </DialogContent>
               </Dialog>
             </div>
           )}
         </div>
       </div>
     );
   }

  // List view
  return (
    <div className="w-full max-w-4xl mx-auto space-y-6 px-4" onMouseEnter={blockTranslationFeedback}>
             {onBack && (
            <Button
  onClick={() => window.location.href = '/'}
  variant="ghost" 
  className="text-white hover:text-amber-400 transition-colors"
>
  홈 가기
</Button>
       )}
      <div className="text-center mb-8">
        <h2 className="text-3xl font-bold text-white mb-2" onMouseEnter={blockTranslationFeedback}>App Story</h2>
        <p className="text-gray-400">Discover the development process and stories behind our apps</p>
                 {isAuthenticated && (
           <div className="mt-4">
             <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
               <DialogTrigger asChild>
                 <Button 
                   onClick={resetForm}
                   className="gap-2"
                   onMouseEnter={blockTranslationFeedback}
                 >
                   <Plus className="h-4 w-4" />
                   새 App Story 작성
                 </Button>
               </DialogTrigger>
               <DialogContent 
                 className="sm:max-w-[600px] max-h-[80vh] overflow-y-auto"
                 onMouseEnter={blockTranslationFeedback}
               >
                <DialogHeader>
                  <DialogTitle>
                    {editingContent ? 'App Story 수정' : '새 App Story 작성'}
                  </DialogTitle>
                  <DialogDescription>
                    앱 개발 과정과 이야기를 작성하세요.
                  </DialogDescription>
                </DialogHeader>
                
                <div className="space-y-4">
                  <div onMouseEnter={blockTranslationFeedback}>
                    <label htmlFor="title-2" className="block text-sm font-medium mb-2">제목 *</label>
                    <Input
                      id="title-2"
                      name="title"
                      value={formData.title}
                      onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
                      placeholder="제목을 입력하세요"
                      onMouseEnter={blockTranslationFeedback}
                    />
                  </div>

                  <div onMouseEnter={blockTranslationFeedback}>
                    <label htmlFor="author-2" className="block text-sm font-medium mb-2">작성자 *</label>
                    <Input
                      id="author-2"
                      name="author"
                      value={formData.author}
                      onChange={(e) => setFormData(prev => ({ ...prev, author: e.target.value }))}
                      placeholder="작성자명을 입력하세요"
                      onMouseEnter={blockTranslationFeedback}
                    />
                  </div>

                  <div onMouseEnter={blockTranslationFeedback}>
                    <label htmlFor="content-2" className="block text-sm font-medium mb-2">내용 *</label>
                    <Textarea
                      id="content-2"
                      name="content"
                      value={formData.content}
                      onChange={(e) => setFormData(prev => ({ ...prev, content: e.target.value }))}
                      placeholder="내용을 입력하세요 (마크다운 지원)"
                      rows={10}
                      onMouseEnter={blockTranslationFeedback}
                    />
                  </div>

                  <div onMouseEnter={blockTranslationFeedback}>
                    <label htmlFor="tags-2" className="block text-sm font-medium mb-2">태그</label>
                    <Input
                      id="tags-2"
                      name="tags"
                      value={formData.tags}
                      onChange={(e) => setFormData(prev => ({ ...prev, tags: e.target.value }))}
                      placeholder="태그를 쉼표로 구분하여 입력하세요"
                      onMouseEnter={blockTranslationFeedback}
                    />
                  </div>

                  <div>
                    <label className="block text-sm font-medium mb-2">대표 이미지 (선택사항)</label>
                    <div className="space-y-2">
                      <input
                        id="image-upload"
                        type="file"
                        accept="image/*"
                        onChange={handleImageSelect}
                        className="hidden"
                      />
                      <div className="flex gap-2">
                        <button
                          type="button"
                          onClick={() => document.getElementById('image-upload')?.click()}
                          className="px-3 py-2 text-sm bg-gray-800 border border-gray-600 text-gray-300 hover:border-amber-400 rounded transition-colors"
                        >
                          이미지 선택
                        </button>
                        {selectedImage && (
                          <button
                            type="button"
                            onClick={handleRemoveImage}
                            className="px-3 py-2 text-sm bg-red-600 border border-red-600 text-white hover:bg-red-700 rounded transition-colors"
                          >
                            제거
                          </button>
                        )}
                      </div>
                      {imagePreview && (
                        <div className="mt-2">
                          <img
                            src={imagePreview}
                            alt="미리보기"
                            className="w-32 h-32 object-cover rounded border"
                          />
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="flex items-center space-x-2 p-3 bg-gray-700/50 rounded-lg border border-gray-600">
                    <input
                      type="checkbox"
                      id="isPublished"
                      checked={formData.isPublished}
                      onChange={(e) => setFormData(prev => ({ ...prev, isPublished: e.target.checked }))}
                      className="w-4 h-4 text-amber-400 bg-gray-800 border-gray-600 rounded focus:ring-amber-400 focus:ring-2"
                    />
                    <label htmlFor="isPublished" className="text-sm font-medium text-white">
                      게시하기 (체크 시 App Story 목록에 표시)
                    </label>
                  </div>
                </div>

                                 <DialogFooter>
                   <Button 
                     variant="outline" 
                     onClick={() => setIsDialogOpen(false)}
                     onMouseEnter={blockTranslationFeedback}
                   >
                     취소
                   </Button>
                   <Button 
                     onClick={handleSubmit}
                     onMouseEnter={blockTranslationFeedback}
                   >
                     {editingContent ? '수정' : '저장'}
                   </Button>
                 </DialogFooter>
              </DialogContent>
            </Dialog>
          </div>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
        {contents.map((content) => (
                     <Card
             key={content.id}
             className="bg-gray-800/50 border-2 border-gray-700 hover:border-amber-400/70 hover:bg-gray-800/80 transition-all duration-300 cursor-pointer group"
             onClick={() => {
               setSelected(content);
               blockTranslationFeedback();
             }}
           >
            <CardHeader className="pb-3">
              {content.imageUrl && (
                <div className="mb-3">
                  <img
                    src={content.imageUrl}
                    alt={content.title}
                    className="w-full h-auto rounded-lg"
                  />
                </div>
              )}
                             <CardTitle className="text-lg font-semibold text-white group-hover:text-amber-300 transition-colors line-clamp-2" translate="no">
                 {content.title}
               </CardTitle>
            </CardHeader>
            <CardContent className="pt-0">
              <div className="flex items-center justify-between text-sm text-gray-400">
                                 <span className="flex items-center gap-1">
                   <User className="w-3 h-3" />
                   <span translate="no">{content.author}</span>
                 </span>
                <span className="flex items-center gap-1">
                  <Calendar className="w-3 h-3" />
                  {new Date(content.publishDate).toLocaleDateString()}
                </span>
              </div>
              
              {isAuthenticated && (
                <div className="flex items-center gap-2 mt-2" onClick={(e) => e.stopPropagation()} onMouseEnter={blockTranslationFeedback}>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={createAdminButtonHandler(() => togglePublish(content))}
                    className="text-gray-400 hover:text-white"
                    onMouseEnter={blockTranslationFeedback}
                  >
                    {content.isPublished ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={createAdminButtonHandler(() => handleEdit(content))}
                    className="text-gray-400 hover:text-white"
                    onMouseEnter={blockTranslationFeedback}
                  >
                    <Edit className="h-4 w-4" />
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={createAdminButtonHandler(() => handleDelete(content.id))}
                    className="text-red-400 hover:text-red-300"
                    onMouseEnter={blockTranslationFeedback}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        ))}
      </div>
    </div>
  );
}
