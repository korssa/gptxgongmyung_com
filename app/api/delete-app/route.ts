import { NextRequest, NextResponse } from 'next/server';
import { promises as fs } from 'fs';
import path from 'path';
import { del, list } from '@vercel/blob';

interface AppItem {
  id: string;
  name: string;
  developer: string;
  description: string;
  iconUrl: string;
  screenshotUrls: string[];
  store: string;
  status: string;
  rating: number;
  downloads: string;
  views: number;
  likes: number;
  uploadDate: string;
  tags?: string[];
  storeUrl?: string;
  version?: string;
  size?: string;
  category?: string;
}

// 파일 삭제 헬퍼 함수
async function deleteFile(url: string): Promise<boolean> {
  try {
    // Vercel Blob Storage URL인 경우
    if (url.includes('vercel-storage.com') || url.includes('blob.vercel-storage.com')) {
      await del(url);
      return true;
    }

    // 로컬 파일인 경우
    if (url.startsWith('/uploads/')) {
      const fileName = url.split('/').pop();
      if (!fileName) {
        return false;
      }

      const filePath = path.join(process.cwd(), 'public', 'uploads', fileName);
      
      // 파일 존재 여부 확인
      try {
        await fs.access(filePath);
      } catch {
        return false;
      }

      // 파일 삭제
      await fs.unlink(filePath);
      return true;
    }

    // 외부 URL인 경우 (삭제 불가)
    return false;
  } catch {
    return false;
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { id, iconUrl, screenshotUrls } = await request.json();

    if (!id) {
      return NextResponse.json(
        { error: 'App ID is required' },
        { status: 400 }
      );
    }

    // ✅ 개별 JSON 파일 삭제 (Featured/Events 방식)
    let jsonDeleted = false;
    try {
      // gallery-gallery 폴더에서 해당 ID의 JSON 파일 찾기
      const { blobs } = await list({ prefix: 'gallery-gallery/', limit: 100 });
      const jsonFile = blobs.find(blob => 
        blob.pathname.endsWith('.json') && 
        blob.pathname.includes(id)
      );

      if (jsonFile) {
        await del(jsonFile.url);
        jsonDeleted = true;
        console.log(`✅ 갤러리 앱 JSON 파일 삭제 성공: ${id} -> ${jsonFile.pathname}`);
      } else {
        console.log(`⚠️ 갤러리 앱 JSON 파일을 찾을 수 없음: ${id}`);
      }
    } catch (error) {
      console.error(`❌ 갤러리 앱 JSON 파일 삭제 실패: ${id}`, error);
    }

    // 아이콘 파일 삭제
    let iconDeleted = false;
    if (iconUrl) {
      iconDeleted = await deleteFile(iconUrl);
    }

    // 스크린샷 파일들 삭제
    let screenshotsDeleted = 0;
    if (screenshotUrls && Array.isArray(screenshotUrls)) {
      for (const screenshotUrl of screenshotUrls) {
        const deleted = await deleteFile(screenshotUrl);
        if (deleted) {
          screenshotsDeleted++;
        }
      }
    }

    const result = {
      success: true,
      deletedAppId: id,
      deletedJson: jsonDeleted,
      deletedIcon: iconDeleted,
      deletedScreenshots: screenshotsDeleted
    };

    console.log(`🗑️ 앱 삭제 완료: ${id}`, result);
    return NextResponse.json(result);

  } catch (error) {
    console.error('❌ 앱 삭제 오류:', error);
    return NextResponse.json(
      { 
        success: false, 
        error: 'Failed to delete app',
        details: error instanceof Error ? error.message : String(error)
      },
      { status: 500 }
    );
  }
}
