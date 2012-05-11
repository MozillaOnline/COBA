/*
This file is part of Fire-IE.

Fire-IE is free software: you can redistribute it and/or modify
it under the terms of the GNU General Public License as published by
the Free Software Foundation, either version 3 of the License, or
(at your option) any later version.

Fire-IE is distributed in the hope that it will be useful,
but WITHOUT ANY WARRANTY; without even the implied warranty of
MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
GNU General Public License for more details.

You should have received a copy of the GNU General Public License
along with Fire-IE.  If not, see <http://www.gnu.org/licenses/>.
*/
#pragma once
namespace BrowserHook
{
	/**
	* ��������ڴ���DEP���⡣��Win7ϵͳ�У����CPU֧��DEP���֣���Ĭ��
	* ����ϵͳ�����£����ؾɰ�Alt�����ActiveX�ᵼ��Firefox������
	*/
	class AtlDepHook
	{
	public:
		static AtlDepHook s_instance;
		void Install(void);
		void Uninstall(void);
	private:
		AtlDepHook(void){}
		~AtlDepHook(void){}
	};
}

