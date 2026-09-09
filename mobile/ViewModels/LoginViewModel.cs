using CommunityToolkit.Mvvm.ComponentModel;
using CommunityToolkit.Mvvm.Input;
using CombinedStudies.Mobile.Services;

namespace CombinedStudies.Mobile.ViewModels;

public partial class LoginViewModel(IAuthService authService) : ObservableObject
{
    [ObservableProperty] private string email = "";
    [ObservableProperty] private string password = "";
    [ObservableProperty] private string errorMessage = "";
    [ObservableProperty] private bool isBusy;

    [RelayCommand]
    private async Task LoginAsync()
    {
        if (string.IsNullOrWhiteSpace(Email) || string.IsNullOrWhiteSpace(Password)) return;

        ErrorMessage = "";
        IsBusy = true;
        try
        {
            await authService.LoginAsync(Email, Password);
            await Shell.Current.GoToAsync("//home");
        }
        catch (HttpRequestException ex) when (ex.StatusCode == System.Net.HttpStatusCode.Unauthorized)
        {
            ErrorMessage = "Invalid email or password.";
        }
        catch
        {
            ErrorMessage = "Something went wrong. Please try again.";
        }
        finally
        {
            IsBusy = false;
        }
    }

    [RelayCommand]
    private async Task GoToRegisterAsync() =>
        await Shell.Current.GoToAsync("//register");
}
