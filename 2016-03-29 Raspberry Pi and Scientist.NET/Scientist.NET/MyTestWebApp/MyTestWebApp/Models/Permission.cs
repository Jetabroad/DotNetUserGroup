namespace MyTestWebApp
{
    public class Permission
    {
        public string RoleName { get; internal set; }
        public string UserName { get; internal set; }

        public override bool Equals(object obj)
        {
            var other = obj as Permission;
            return other != null && other.RoleName == this.RoleName && other.UserName == this.UserName && other.GetType() == this.GetType();
        }

        public override int GetHashCode()
        {
            return this.UserName.GetHashCode() * 17 + this.RoleName.GetHashCode();
        }
    }
}